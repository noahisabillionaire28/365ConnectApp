import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { verifierStatus } from "../lib/jwtVerify.js";
import { aiConfigured } from "../lib/matching.js";
import { mapsConfigured } from "../lib/appleMaps.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  // Which integrations are configured (no secrets exposed).
  res.json({ ...data, auth: verifierStatus(), ai: aiConfigured(), maps: mapsConfigured() ? 'apple' : 'fallback' });
});

export default router;
