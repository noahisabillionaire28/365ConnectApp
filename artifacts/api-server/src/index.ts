import app from "./app";
import { logger } from "./lib/logger";
import { seedTestUser } from "./routes/seed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Seed the test account on startup (no-op if already exists or key not set)
  try {
    const result = await seedTestUser();
    if (result.ok) {
      logger.info(result, "Seed complete");
    } else {
      logger.warn(result, "Seed skipped or failed");
    }
  } catch (seedErr) {
    logger.warn({ err: seedErr }, "Seed threw unexpectedly");
  }
});
