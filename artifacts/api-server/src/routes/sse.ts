/**
 * GET /api/sse?token=<supabase access token>
 *
 * Opens a long-lived Server-Sent Events stream for the authenticated user.
 * EventSource cannot send headers, so the SPA passes its Supabase access token
 * as `?token=`. The token is verified exactly like the Authorization header is
 * (local JWT verification, falling back to Supabase Auth when the signing key
 * is unavailable) and the stream is bound to the token's subject. A `userId`
 * query param is ignored: identity only ever comes from a verified token.
 */
import { Router } from "express";
import { addConnection, removeConnection } from "../lib/sseManager.js";
import { adminDb } from "../lib/supabaseAdmin.js";
import { verifySupabaseToken } from "../lib/jwtVerify.js";
import { logger } from "../lib/logger.js";

const router = Router();

/** Resolve a user id from a Supabase access token, or null when invalid. */
async function userIdFromToken(token: string): Promise<string | null> {
  try {
    const local = await verifySupabaseToken(token);
    if (local.ok === true) return local.userId;
    if (local.ok === false) return null;
    // Cannot verify locally — ask Supabase Auth (authoritative).
    const { data, error } = await adminDb.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "sse token verification threw");
    return null;
  }
}

router.get("/sse", async (req, res) => {
  const rawToken = req.query.token;
  const token = typeof rawToken === "string" && rawToken.trim() ? rawToken.trim() : null;

  // Prefer the header-verified identity (attachUserId) when a non-browser client
  // sends one; otherwise verify the query token. Never trust `?userId=`.
  let userId: string | null = req.userId ?? null;
  if (!userId && token) userId = await userIdFromToken(token);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized — a valid access token is required" });
    return;
  }

  // Standard SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx / reverse-proxy buffering

  res.flushHeaders();

  // Send an immediate connected event so the client knows it's live
  res.write(`event: connected\ndata: {}\n\n`);

  addConnection(userId, res);

  // Heartbeat every 25 s keeps the connection alive through idle timeouts
  const heartbeat = setInterval(() => {
    try {
      res.write(`:heartbeat\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeConnection(userId, res);
  });
});

export default router;
