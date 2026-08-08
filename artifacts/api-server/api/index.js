/**
 * Vercel serverless function.
 *
 * Plain JS (no TypeScript compile step) that re-exports the pre-built Express
 * app produced by `build.mjs` (dist/serverless.mjs). vercel.json rewrites every
 * path to this function, and the app handles all `/api/*` routes.
 */
export { default } from "../dist/serverless.mjs";
