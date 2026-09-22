/**
 * A typed error that carries an HTTP status, so shared helpers (ownership
 * checks, booking) can signal 403/404/409 to the route without every route
 * re-implementing the mapping. Routes catch it with `sendError`.
 */
import type { Response } from 'express';

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** Reply with an HttpError's status + message, or a 500 for anything else. */
export function sendError(res: Response, e: unknown): void {
  if (e instanceof HttpError) {
    res.status(e.status).json({ error: e.message });
    return;
  }
  const msg = e instanceof Error ? e.message : String(e);
  res.status(500).json({ error: msg });
}
