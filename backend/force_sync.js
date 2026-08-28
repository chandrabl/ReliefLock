import mongoose from "mongoose";
import { env } from "./dist/config/env.js";
import { BlockchainSyncService } from "./dist/services/blockchainSync.js";

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log("Connected to DB");
  const sync = new BlockchainSyncService();
  await sync.reconcilePendingTransactions();
  console.log("Reconciliation complete.");
  
  // also force refresh campaign 19 just in case
  await sync.refreshCampaign(19);
  console.log("Refreshed campaign 19");

  process.exit(0);
}

run().catch(console.error);
