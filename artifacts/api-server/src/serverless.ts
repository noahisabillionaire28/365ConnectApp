/**
 * Serverless entry — exports the Express app (no `listen`) so it can run as a
 * Vercel function. The regular server entry (index.ts) still calls listen for
 * local/other hosts; this variant is what the bundled Vercel function uses.
 */
import app from "./app";

export default app;
