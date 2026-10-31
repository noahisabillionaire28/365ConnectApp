import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();
app.disable("x-powered-by");

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── Who may call the API from a browser ──────────────────────────────────────
// The web app (and its www alias), the native shell's origins, Vercel preview
// builds of the web app, and localhost while developing. Everything else gets
// no CORS headers, so a page on another site cannot read responses.
const APP_ORIGIN = (() => { try { return new URL(process.env["APP_URL"] ?? "https://join365connect.com").origin; } catch { return "https://join365connect.com"; } })();
const STATIC_ORIGINS = new Set([
  APP_ORIGIN,
  APP_ORIGIN.replace("://", "://www."),
  "https://app.365connect.local",
  "capacitor://localhost",
  "ionic://localhost",
]);
function originAllowed(origin: string): boolean {
  if (STATIC_ORIGINS.has(origin)) return true;
  if (/^https:\/\/365-connect(-[a-z0-9-]+)?(-lucrosai)?\.vercel\.app$/.test(origin)) return true;
  return process.env["NODE_ENV"] !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}
app.use(cors({
  origin(origin, cb) {
    // No Origin header: same-origin, curl, cron, server-to-server. Allowed.
    if (!origin) return cb(null, true);
    return cb(null, originAllowed(origin));
  },
  credentials: true,
  maxAge: 600,
}));

// ── Security headers on every response ───────────────────────────────────────
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // The API only ever returns JSON and event streams; nothing here is a page.
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  res.setHeader("Cache-Control", "no-store");
  next();
});

// ── Never show callers the database's own words ──────────────────────────────
// Route handlers answer 500s with whatever message the library raised. Those
// messages name tables, columns and constraints, which is useful to us in the
// logs and useful to an attacker in a response. Swap the body for a generic
// line and keep the detail server-side under the request id.
app.use((req: Request, res: Response, next: NextFunction) => {
  const json = res.json.bind(res);
  res.json = (body: unknown) => {
    if (res.statusCode >= 500 && body && typeof body === "object" && "error" in (body as Record<string, unknown>)) {
      const detail = (body as Record<string, unknown>).error;
      req.log?.error({ detail }, "request failed");
      return json({ error: "Something went wrong on our side. Please try again.", request_id: req.id });
    }
    return json(body);
  };
  next();
});

app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: false, limit: "50kb" }));

app.use("/api", router);

export default app;
