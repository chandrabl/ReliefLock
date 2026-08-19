import { Contract, rpc, scValToNative, xdr, nativeToScVal } from "@stellar/stellar-sdk";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

/**
 * Read-only helper for querying the ReliefLock Soroban contract's public
 * getters (get_campaign, get_voucher, get_campaign_balance, ...) via
 * simulation, without needing a signing key. Used by the sync service and
 * by API routes that want a live on-chain read instead of the cached copy.
 *
 * State-changing calls (fund_campaign, claim_aid, redeem_voucher, ...) are
 * NEVER submitted from the backend — those are always signed client-side
 * by the user's own wallet (Freighter) and submitted directly to the
 * network from the frontend. The backend only ever indexes the result.
 */
export class ContractClient {
  private server: rpc.Server;
  private contractId: string;

  constructor(contractId?: string) {
    if (!contractId && !env.CONTRACT_ID) {
      throw new Error("CONTRACT_ID is not configured");
    }
    this.contractId = contractId ?? env.CONTRACT_ID!;
    this.server = new rpc.Server(env.STELLAR_RPC_URL, { allowHttp: false });
  }

  async simulateReadOnly<T>(method: string, args: xdr.ScVal[] = []): Promise<T | null> {
    try {
      const contract = new Contract(this.contractId);
      const operation = contract.call(method, ...args);

      // A throwaway source account is fine for simulation-only reads.
      const account = await this.server.getAccount(
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      ).catch(() => null);
      if (!account) {
        logger.warn("Unable to fetch simulation source account; skipping read");
        return null;
      }

      const { TransactionBuilder, BASE_FEE, Networks } = await import("@stellar/stellar-sdk");
      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: env.STELLAR_NETWORK === "TESTNET" ? Networks.TESTNET : Networks.PUBLIC,
      })
        .addOperation(operation)
        .setTimeout(30)
        .build();

      const sim = await this.server.simulateTransaction(tx);
      if (rpc.Api.isSimulationError(sim)) {
        logger.error({ error: sim.error, method }, "Contract simulation failed");
        return null;
      }
      if (!sim.result?.retval) return null;
      return scValToNative(sim.result.retval) as T;
    } catch (err) {
      logger.error({ err, method }, "Contract read failed");
      return null;
    }
  }

  async getCampaign(campaignId: number) {
    return this.simulateReadOnly("get_campaign", [nativeToScVal(campaignId, { type: "u64" })]);
  }

  async getCampaignBalance(campaignId: number) {
    return this.simulateReadOnly<bigint>("get_campaign_balance", [
      nativeToScVal(campaignId, { type: "u64" }),
    ]);
  }
}
