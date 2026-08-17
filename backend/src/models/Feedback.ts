import { Schema, model, type InferSchemaType } from "mongoose";

const feedbackSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    campaignOnChainId: { type: Number, required: true },
    processEasy: { type: Number, min: 1, max: 5, required: true },
    eligibilityClear: { type: Number, min: 1, max: 5, required: true },
    walletConnectionEasy: { type: Number, min: 1, max: 5, required: true },
    paymentArrivedSuccessfully: { type: Boolean, required: true },
    comments: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

feedbackSchema.index({ campaignOnChainId: 1 });

export type FeedbackDoc = InferSchemaType<typeof feedbackSchema>;
export const Feedback = model("Feedback", feedbackSchema);
