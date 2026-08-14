import * as Sentry from "@sentry/node";
import { createApp } from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { BlockchainSyncService } from "./services/blockchainSync.js";

async function main() {
  if (env.SENTRY_DSN) {
    Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV, tracesSampleRate: 0.2 });
  }

  await connectDB();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`ReliefLock API listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  const sync = new BlockchainSyncService();
  sync.start();

  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully`);
    sync.stop();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal startup error:", err);
  process.exit(1);
});
