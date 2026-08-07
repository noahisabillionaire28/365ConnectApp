/**
 * Vercel serverless entry point.
 *
 * Vercel serves everything through a single function that hands the request to
 * the existing Express app. The app already mounts all routes under `/api`, and
 * vercel.json rewrites every incoming path to this function, so Express sees the
 * original URL (e.g. `/api/users/me`) unchanged.
 */
import app from '../src/app.js';

export default app;
