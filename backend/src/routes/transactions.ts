import { Router } from "express";
import { z } from "zod";
import { Transaction, TX_TYPES } from "../models/Transaction.js";
import { requireAuth } from "../middleware/auth.js";
import { ApiError } from "../middleware/errorHandler.js";

export const transactionsRouter = Router();

const recordSchema = z.object({
  hash: z.string().min(10),
  type: z.enum(TX_TYPES),
  campaignOnChainId: z.number().int().optional(),
  initiatorWallet: z.string(),
  counterpartyWallet: z.string().optional(),
  amount: z.string().optional(),
});

// The frontend calls this the moment it submits a signed transaction to
// the network, so the UI can show "pending" immediately. The sync service
// (services/blockchainSync.ts) later flips it to confirmed/failed once it
// observes the transaction result on-chain — the frontend must never mark
// its own transaction confirmed just because the wallet popup was approved.
transactionsRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const body = recordSchema.parse(req.body);
    const tx = await Transaction.create({ ...body, txHash: body.hash, status: "pending" });
    res.status(201).json(tx);
  } catch (err) {
    next(err);
  }
});

transactionsRouter.get("/test", async (req, res) => {
  const txs = await Transaction.find({ type: "add_beneficiary" });
  res.json(txs);
});

transactionsRouter.get("/:hash", async (req, res, next) => {
  try {
    const tx = await Transaction.findOne({ hash: req.params.hash });
    if (!tx) throw new ApiError(404, "Transaction not found");
    res.json(tx);
  } catch (err) {
    next(err);
  }
});

transactionsRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const { wallet, campaignOnChainId } = req.query;
    const filter: Record<string, unknown> = {};
    if (wallet) filter.initiatorWallet = wallet;
    if (campaignOnChainId) filter.campaignOnChainId = Number(campaignOnChainId);
    const items = await Transaction.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});
