import express, { Express } from "express";
import { Pool } from "pg";
import { MeterService } from "./services/meterService.js";
import { createGenerateRouter } from "./routes/generate.js";
import { createStripeRouter } from "./routes/stripe.js";
import { createUsageRouter } from "./routes/usage.js";
import { CostService } from "./services/costService.js";

export function createApp(dbPool: Pool): Express {
  const app = express();

  // Stripe Router mounted FIRST (it handles its own body parsing for webhooks)
  app.use(createStripeRouter(dbPool));

  // Global Middleware
  app.use(express.json());

  // Services & Routers
  const meterService = new MeterService(dbPool);
  app.use(createGenerateRouter(meterService));

  // Inside createApp(dbPool):
  const costService = new CostService(dbPool);
  app.use(createUsageRouter(costService));

  return app;
}
