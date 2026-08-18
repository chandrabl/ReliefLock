import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User, USER_ROLES } from "../models/User.js";
import { requireAuth, signToken } from "../middleware/auth.js";
import { ApiError } from "../middleware/errorHandler.js";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  role: z.enum(USER_ROLES),
  walletAddress: z.string().optional(),
  organizationName: z.string().optional(),
});

authRouter.post("/register", async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const existing = await User.findOne({ email: body.email });
    if (existing) throw new ApiError(409, "Email already registered");

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await User.create({
      email: body.email,
      passwordHash,
      fullName: body.fullName,
      role: body.role,
      walletAddress: body.walletAddress,
      organizationName: body.organizationName,
    });

    const token = signToken({ sub: user.id, role: user.role, walletAddress: user.walletAddress ?? undefined });
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await User.findOne({ email: body.email });
    if (!user) throw new ApiError(401, "Invalid credentials");

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) throw new ApiError(401, "Invalid credentials");

    const token = signToken({ sub: user.id, role: user.role, walletAddress: user.walletAddress ?? undefined });
    res.json({
      token,
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

const linkWalletSchema = z.object({ walletAddress: z.string().min(10) });

authRouter.post("/wallet", requireAuth, async (req, res, next) => {
  try {
    if (!req.auth) throw new ApiError(401, "Unauthorized");
    const body = linkWalletSchema.parse(req.body);
    await User.findByIdAndUpdate(req.auth.sub, { walletAddress: body.walletAddress });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
