/**
 * GET /api/sse?userId=<id>
 *
 * Opens a long-lived Server-Sent Events stream for the given user.
 * EventSource doesn't support custom headers, so we accept userId as a query
 * param. In production, Task #21's Clerk session cookie already identifies the
 * user — userId is a belt-and-suspenders convenience for dev.
 */
import { Router } from "express";
import { addConnection, removeConnection } from "../lib/sseManager.js";

const router = Router();

router.get("/sse", (req, res) => {
  // Accept userId from query param or from Clerk middleware (req.userId)
  const userId =
    (req.query.userId as string | undefined) ?? (req as any).userId ?? null;
  if (!userId) {
    res.status(401).json({ error: "userId required" });
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
