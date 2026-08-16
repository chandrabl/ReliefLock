import { Schema, model, type InferSchemaType } from "mongoose";

export const CAMPAIGN_STATUSES = [
  "Draft",
  "Active",
  "Paused",
  "Expired",
  "Completed",
  "Cancelled",
] as const;

/**
 * IMPORTANT: This collection is a read cache / metadata store, NOT the
 * source of truth for funding, distribution, or claim state — that lives
 * on-chain in the Soroban contract and is written here only by the
 * blockchain sync service (see services/blockchainSync.ts) reconciling
 * against indexed contract events. Off-chain-only fields (description,
 * media, category) are authored directly by the NGO through this API.
 */
const campaignSchema = new Schema(
  {
    onChainId: { type: Number, required: true, unique: true, index: true },
    ngoUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ngoWallet: { type: String, required: true, index: true },

    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: { type: String, trim: true },
    coverImageUrl: { type: String, trim: true },

    token: { type: String, required: true },
    totalFunding: { type: String, required: true }, // i128 as string to avoid precision loss
    allocationPerBeneficiary: { type: String, required: true },
    startTime: { type: Date, required: true },
    expiryTime: { type: Date, required: true },
    maxClaimsPerBeneficiary: { type: Number, required: true },
    merchantRestricted: { type: Boolean, default: false },

    // Mirrored from chain by the sync service — do not trust for payouts.
    status: { type: String, enum: CAMPAIGN_STATUSES, default: "Draft" },
    fundedAmount: { type: String, default: "0" },
    distributedAmount: { type: String, default: "0" },
    lastSyncedLedger: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type CampaignDoc = InferSchemaType<typeof campaignSchema>;
export const Campaign = model("Campaign", campaignSchema);
