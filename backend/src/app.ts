import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/auth.js";
import { campaignsRouter } from "./routes/campaigns.js";
import { transactionsRouter } from "./routes/transactions.js";
import { feedbackRouter } from "./routes/feedback.js";
import { applicationsRouter } from "./routes/applications.js";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(pinoHttp({ logger }));
  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      limit: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", env: env.NODE_ENV, timestamp: new Date().toISOString() });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/campaigns", campaignsRouter);
  app.use("/api/transactions", transactionsRouter);
  app.use("/api/feedback", feedbackRouter);
  app.use("/api/applications", applicationsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
