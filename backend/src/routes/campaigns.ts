import { Router } from "express";
import { z } from "zod";
import { Campaign } from "../models/Campaign.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ApiError } from "../middleware/errorHandler.js";

export const campaignsRouter = Router();

// Public: browse campaigns (beneficiaries don't need auth to see what exists)
campaignsRouter.get("/", async (req, res, next) => {
  try {
    const { status, category, page = "1", limit = "20" } = req.query;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (category) filter.category = category;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(50, Math.max(1, Number(limit)));

    const [items, total] = await Promise.all([
      Campaign.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Campaign.countDocuments(filter),
    ]);

    res.json({ items, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (err) {
    next(err);
  }
});

campaignsRouter.get("/:onChainId", async (req, res, next) => {
  try {
    const campaign = await Campaign.findOne({ onChainId: Number(req.params.onChainId) });
    if (!campaign) throw new ApiError(404, "Campaign not found");
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

const createMetaSchema = z.object({
  onChainId: z.number().int().positive(),
  name: z.string().min(2),
  description: z.string().optional(),
  category: z.string().optional(),
  coverImageUrl: z.string().url().optional(),
  token: z.string(),
  totalFunding: z.string(),
  allocationPerBeneficiary: z.string(),
  startTime: z.coerce.date(),
  expiryTime: z.coerce.date(),
  maxClaimsPerBeneficiary: z.number().int().positive(),
  merchantRestricted: z.boolean().default(false),
  ngoWallet: z.string(),
});

// Called by the frontend immediately after the on-chain create_campaign tx
// confirms, to attach the human-facing metadata (description, images,
// category) that intentionally never touches the chain.
campaignsRouter.post("/", requireAuth, requireRole("ngo"), async (req, res, next) => {
  try {
    const body = createMetaSchema.parse(req.body);
    const existing = await Campaign.findOne({ onChainId: body.onChainId });
    if (existing) throw new ApiError(409, "Campaign metadata already exists for this on-chain id");

    const campaign = await Campaign.create({
      ...body,
      ngoUserId: req.auth!.sub,
      status: "Draft",
    });
    res.status(201).json(campaign);
  } catch (err) {
    next(err);
  }
});

const updateMetaSchema = z.object({
  description: z.string().optional(),
  category: z.string().optional(),
  coverImageUrl: z.string().url().optional(),
});

campaignsRouter.patch("/:onChainId", requireAuth, requireRole("ngo"), async (req, res, next) => {
  try {
    const body = updateMetaSchema.parse(req.body);
    const campaign = await Campaign.findOne({ onChainId: Number(req.params.onChainId) });
    if (!campaign) throw new ApiError(404, "Campaign not found");
    if (campaign.ngoUserId.toString() !== req.auth!.sub) {
      throw new ApiError(403, "You do not own this campaign");
    }
    Object.assign(campaign, body);
    await campaign.save();
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});
