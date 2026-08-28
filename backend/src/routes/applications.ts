import { Router } from "express";
import { z } from "zod";
import { Application } from "../models/Application.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ApiError } from "../middleware/errorHandler.js";

export const applicationsRouter = Router();

const applySchema = z.object({
  campaignOnChainId: z.number().int().nonnegative(),
  beneficiaryWallet: z.string().min(10),
});

applicationsRouter.get("/test", async (req, res) => {
  const apps = await Application.find();
  res.json(apps);
});

// Beneficiaries apply for aid
applicationsRouter.post("/", requireAuth, requireRole("beneficiary"), async (req, res, next) => {
  try {
    const body = applySchema.parse(req.body);
    
    // Check if application exists
    const existing = await Application.findOne({
      campaignOnChainId: body.campaignOnChainId,
      beneficiaryWallet: body.beneficiaryWallet,
    });
    if (existing) {
      throw new ApiError(409, "You have already applied for this campaign");
    }

    const application = await Application.create({
      ...body,
      beneficiaryUserId: req.auth!.sub,
      status: "Pending",
    });
    res.status(201).json(application);
  } catch (err) {
    next(err);
  }
});

// NGOs fetch pending applications, beneficiaries fetch their own
applicationsRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const { campaignOnChainId, status, beneficiaryWallet } = req.query;
    const filter: Record<string, unknown> = {};
    if (campaignOnChainId) filter.campaignOnChainId = Number(campaignOnChainId);
    if (status) filter.status = status;
    if (beneficiaryWallet) filter.beneficiaryWallet = beneficiaryWallet;

    // Enforce role-based access
    if (req.auth!.role === "beneficiary") {
      filter.beneficiaryUserId = req.auth!.sub;
    }

    const applications = await Application.find(filter).sort({ createdAt: -1 });
    res.json({ items: applications });
  } catch (err) {
    next(err);
  }
});

// Force update application status
applicationsRouter.patch("/:id/status", requireAuth, requireRole("ngo"), async (req, res, next) => {
  try {
    const app = await Application.findByIdAndUpdate(
      req.params.id,
      { $set: { status: req.body.status } },
      { new: true }
    );
    if (!app) throw new ApiError(404, "Application not found");
    res.json(app);
  } catch (err) {
    next(err);
  }
});
