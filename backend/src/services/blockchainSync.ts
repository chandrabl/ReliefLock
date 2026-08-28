import { rpc } from "@stellar/stellar-sdk";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { Campaign, type CampaignDoc } from "../models/Campaign.js";
import { Transaction } from "../models/Transaction.js";
import { ContractClient } from "./contractClient.js";

/**
 * Polls the Soroban RPC for new ledgers, reconciles pending transactions
 * to confirmed/failed, and refreshes the Campaign read cache from
 * authoritative on-chain state via the contract's getters.
 *
 * This intentionally does NOT try to be a full event-streaming indexer for
 * the MVP — Soroban RPC's getEvents has a limited retention window, which
 * is fine for a hackathon-scale deployment. Production would move this to
 * a dedicated indexer (e.g. Mercury, Subquery, or a self-hosted Horizon +
 * event ingestion pipeline) — noted in the README's "known limitations".
 */
export class BlockchainSyncService {
  private server: rpc.Server;
  private contractClient: ContractClient | null;
  private pollHandle: NodeJS.Timeout | null = null;

  constructor() {
    this.server = new rpc.Server(env.STELLAR_RPC_URL, { allowHttp: false });
    try {
      this.contractClient = new ContractClient();
    } catch {
      logger.warn("CONTRACT_ID not set — blockchain sync will run in transaction-status-only mode");
      this.contractClient = null;
    }
  }

  start(intervalMs = 10_000): void {
    if (this.pollHandle) return;

    this.rescueStuckCampaigns().catch((err) =>
      logger.error({ err }, "rescueStuckCampaigns failed"),
    );

    this.pollHandle = setInterval(() => {
      this.reconcilePendingTransactions().catch((err) =>
        logger.error({ err }, "reconcilePendingTransactions failed"),
      );
    }, intervalMs);
    logger.info({ intervalMs }, "Blockchain sync service started");
  }

  async rescueStuckCampaigns(): Promise<void> {
    const draftCampaigns = await Campaign.find({ status: "Draft" });
    for (const c of draftCampaigns) {
      if (c.onChainId != null) {
        try {
          await this.refreshCampaign(c.onChainId);
        } catch (err) {
          logger.error({ err, onChainId: c.onChainId }, "Failed to rescue campaign");
        }
      }
    }
  }

  stop(): void {
    if (this.pollHandle) clearInterval(this.pollHandle);
    this.pollHandle = null;
  }

  async reconcilePendingTransactions(): Promise<void> {
    const pending = await Transaction.find({ status: "pending" }).limit(50);
    if (pending.length === 0) return;

    for (const tx of pending) {
      try {
        const result = await this.server.getTransaction(tx.hash);
        if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
          tx.status = "confirmed";
          tx.confirmedAt = new Date();
          tx.ledgerSequence = result.ledger;
          await tx.save();

          if (
            tx.type === "add_beneficiary" &&
            tx.campaignOnChainId != null &&
            tx.counterpartyWallet != null
          ) {
            const { Application } = await import("../models/Application.js");
            await Application.findOneAndUpdate(
              { campaignOnChainId: tx.campaignOnChainId, beneficiaryWallet: tx.counterpartyWallet },
              { $set: { status: "Approved" } }
            );
          }

          if (tx.campaignOnChainId != null) {
            await this.refreshCampaign(tx.campaignOnChainId);
          }
        } else if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
          tx.status = "failed";
          tx.errorMessage = "Transaction execution failed on-chain";
          await tx.save();
        } else if (result.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
          const ageMs = Date.now() - new Date(tx.submittedAt).getTime();
          if (ageMs > 5 * 60_000) {
            tx.status = "expired";
            await tx.save();
          }
        }
      } catch (err) {
        logger.error({ err, hash: tx.hash }, "Failed to reconcile transaction");
      }
    }
  }

  async refreshCampaign(onChainId: number): Promise<CampaignDoc | null> {
    if (!this.contractClient) return null;
    const onChain = await this.contractClient.getCampaign(onChainId);
    if (!onChain) return null;

    let newStatus = (onChain as any).status;
    if (Array.isArray(newStatus)) {
      newStatus = newStatus[0];
    }

    const updated = await Campaign.findOneAndUpdate(
      { onChainId },
      {
        $set: {
          status: newStatus,
          fundedAmount: String((onChain as { funded_amount: bigint }).funded_amount ?? "0"),
          distributedAmount: String(
            (onChain as { distributed_amount: bigint }).distributed_amount ?? "0",
          ),
          lastSyncedLedger: (await this.server.getLatestLedger()).sequence,
        },
      },
      { new: true },
    );
    return updated;
  }
}
