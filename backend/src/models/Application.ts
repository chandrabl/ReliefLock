import { Schema, model, Document } from "mongoose";

export interface ApplicationDoc extends Document {
  campaignOnChainId: number;
  beneficiaryWallet: string;
  beneficiaryUserId: string; // The user id from the User collection
  status: "Pending" | "Approved" | "Rejected";
  createdAt: Date;
  updatedAt: Date;
}

const applicationSchema = new Schema<ApplicationDoc>(
  {
    campaignOnChainId: { type: Number, required: true },
    beneficiaryWallet: { type: String, required: true },
    beneficiaryUserId: { type: String, required: true },
    status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
  },
  { timestamps: true },
);

// Prevent duplicate applications
applicationSchema.index({ campaignOnChainId: 1, beneficiaryWallet: 1 }, { unique: true });

export const Application = model<ApplicationDoc>("Application", applicationSchema);
