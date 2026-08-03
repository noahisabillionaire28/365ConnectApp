/**
 * SSE connection manager.
 *
 * Keeps a set of live Response objects per userId so we can push events to any
 * connected tab without polling.
 */
import type { Response } from "express";

const connections = new Map<string, Set<Response>>();

export function addConnection(userId: string, res: Response): void {
  if (!connections.has(userId)) connections.set(userId, new Set());
  connections.get(userId)!.add(res);
}

export function removeConnection(userId: string, res: Response): void {
  const set = connections.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) connections.delete(userId);
}

/**
 * Push a named event + JSON payload to all connections for a user.
 * Silently skips users with no open connections.
 */
export function broadcastToUser(
  userId: string,
  event: string,
  data: unknown,
): void {
  const set = connections.get(userId);
  if (!set || set.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch {
      // Connection already closed — cleanup happens in req.on("close")
    }
  }
}
