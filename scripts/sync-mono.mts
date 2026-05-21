import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

loadDotEnv();

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    "lookback-days": { type: "string" },
    "rate-limit-ms": { type: "string" },
    quiet: { type: "boolean" },
  },
  allowPositionals: true,
});

const accountId = Number(positionals[0]);
if (!Number.isFinite(accountId)) {
  console.error(
    "Usage: tsx scripts/sync-mono.mts <accountId> [--lookback-days=N] [--rate-limit-ms=N] [--quiet]",
  );
  process.exit(1);
}

const { createSyncLogger } = await import("../src/lib/sync-logger");
const logger = createSyncLogger({
  source: "cli",
  accountId,
  toStdout: !values.quiet,
});

logger.info(`--- sync run start ---`);

try {
  const { syncMonoAccount } = await import("../src/lib/sync");

  const lookbackDays = values["lookback-days"]
    ? Number(values["lookback-days"])
    : undefined;
  const rateLimitMs = values["rate-limit-ms"]
    ? Number(values["rate-limit-ms"])
    : undefined;

  const startedAt = Date.now();
  const result = await syncMonoAccount(accountId, {
    initialLookbackMs:
      lookbackDays !== undefined
        ? lookbackDays * 24 * 60 * 60 * 1000
        : undefined,
    rateLimitMs,
    log: (message) => logger.info(message),
  });
  const totalMs = Date.now() - startedAt;

  logger.info(
    `Result: inserted=${result.inserted} fetched=${result.fetched} apiCalls=${result.apiCalls} totalMs=${totalMs}`,
  );
  logger.info(`--- sync run ok ---`);

  if (!values.quiet) {
    console.log(JSON.stringify(result, null, 2));
  }
} catch (err) {
  const message =
    err instanceof Error ? (err.stack ?? err.message) : String(err);
  logger.error(`Sync failed: ${message}`);
  logger.info(`--- sync run failed ---`);
  process.exit(1);
}

function loadDotEnv() {
  let raw: string;
  try {
    raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
  } catch {
    return;
  }
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (process.env[key]) continue;
    process.env[key] = value.replace(/^['"]|['"]$/g, "");
  }
}
