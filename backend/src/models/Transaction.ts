import { Schema, model, type InferSchemaType } from "mongoose";

export const TX_STATUSES = ["pending", "confirmed", "failed", "expired"] as const;
export const TX_TYPES = [
  "fund_campaign",
  "claim_aid",
  "issue_voucher",
  "redeem_voucher",
  "close_campaign",
] as const;

const transactionSchema = new Schema(
  {
    hash: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: TX_TYPES, required: true },
    status: { type: String, enum: TX_STATUSES, default: "pending", index: true },
    campaignOnChainId: { type: Number, index: true },
    initiatorWallet: { type: String, required: true, index: true },
    counterpartyWallet: { type: String },
    amount: { type: String },
    ledgerSequence: { type: Number },
    errorMessage: { type: String },
    submittedAt: { type: Date, default: Date.now },
    confirmedAt: { type: Date },
  },
  { timestamps: true },
);

export type TransactionDoc = InferSchemaType<typeof transactionSchema>;
export const Transaction = model("Transaction", transactionSchema);
