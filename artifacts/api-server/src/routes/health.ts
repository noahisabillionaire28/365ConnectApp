import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { verifierStatus } from "../lib/jwtVerify.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  // Which token verifier is configured (no secrets exposed).
  res.json({ ...data, auth: verifierStatus() });
});

export default router;
