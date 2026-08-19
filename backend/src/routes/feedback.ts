import { Router } from "express";
import { z } from "zod";
import { Feedback } from "../models/Feedback.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const feedbackRouter = Router();

const submitSchema = z.object({
  campaignOnChainId: z.number().int().positive(),
  processEasy: z.number().int().min(1).max(5),
  eligibilityClear: z.number().int().min(1).max(5),
  walletConnectionEasy: z.number().int().min(1).max(5),
  paymentArrivedSuccessfully: z.boolean(),
  comments: z.string().max(2000).optional(),
});

feedbackRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const body = submitSchema.parse(req.body);
    const doc = await Feedback.create({ ...body, userId: req.auth!.sub });
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

// NGO/admin summary dashboard — averages across a campaign's responses.
feedbackRouter.get(
  "/summary/:campaignOnChainId",
  requireAuth,
  requireRole("ngo", "platform_admin"),
  async (req, res, next) => {
    try {
      const campaignOnChainId = Number(req.params.campaignOnChainId);
      const items = await Feedback.find({ campaignOnChainId });
      const count = items.length;
      const avg = (field: keyof (typeof items)[number]) =>
        count === 0
          ? null
          : items.reduce((sum, i) => sum + (i[field] as unknown as number), 0) / count;

      res.json({
        campaignOnChainId,
        responseCount: count,
        averages: {
          processEasy: avg("processEasy"),
          eligibilityClear: avg("eligibilityClear"),
          walletConnectionEasy: avg("walletConnectionEasy"),
        },
        paymentSuccessRate:
          count === 0 ? null : items.filter((i) => i.paymentArrivedSuccessfully).length / count,
        recentComments: items
          .filter((i) => i.comments)
          .slice(-10)
          .map((i) => i.comments),
      });
    } catch (err) {
      next(err);
    }
  },
);
