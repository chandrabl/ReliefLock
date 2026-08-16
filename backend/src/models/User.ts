import { Schema, model, type InferSchemaType } from "mongoose";

export const USER_ROLES = ["beneficiary", "ngo", "program_admin", "merchant", "platform_admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true, trim: true },
    role: { type: String, enum: USER_ROLES, required: true },
    walletAddress: { type: String, trim: true },
    // NGO-only fields
    organizationName: { type: String, trim: true },
    organizationDocsUrl: { type: String, trim: true },
    verified: { type: Boolean, default: false },
    // Beneficiary-only off-chain metadata (never stored on-chain)
    phone: { type: String, trim: true },
    documentUrl: { type: String, trim: true },
  },
  { timestamps: true },
);

userSchema.index({ role: 1 });
userSchema.index({ walletAddress: 1 });

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);
