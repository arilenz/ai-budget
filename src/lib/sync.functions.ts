import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { accounts } from "#/db/schema";
import { requireUser } from "#/lib/auth";
import { syncMonoAccount } from "#/lib/sync";
import { createSyncLogger } from "#/lib/sync-logger";

type SyncInput = { accountId: number };

function validateSyncInput(data: unknown): SyncInput {
  if (
    !data ||
    typeof data !== "object" ||
    typeof (data as SyncInput).accountId !== "number"
  ) {
    throw new Error("accountId is required");
  }
  return { accountId: (data as SyncInput).accountId };
}

export const syncMonoAccountFn = createServerFn({ method: "POST" })
  .inputValidator(validateSyncInput)
  .handler(async ({ data }) => {
    const user = await requireUser();
    const account = await db
      .select({ id: accounts.id, userId: accounts.userId })
      .from(accounts)
      .where(eq(accounts.id, data.accountId))
      .get();
    if (!account || account.userId !== user.id) {
      throw new Error("Account not found");
    }
    const logger = createSyncLogger({
      source: "ui",
      accountId: data.accountId,
    });
    logger.info(`--- sync run start ---`);
    const startedAt = Date.now();
    try {
      const result = await syncMonoAccount(data.accountId, {
        log: (message) => logger.info(message),
      });
      logger.info(
        `Result: inserted=${result.inserted} fetched=${result.fetched} apiCalls=${result.apiCalls} totalMs=${Date.now() - startedAt}`,
      );
      logger.info(`--- sync run ok ---`);
      return {
        inserted: result.inserted,
        fetched: result.fetched,
        apiCalls: result.apiCalls,
        rangeFrom: result.rangeFrom.toISOString(),
        rangeTo: result.rangeTo.toISOString(),
      };
    } catch (err) {
      const message =
        err instanceof Error ? (err.stack ?? err.message) : String(err);
      logger.error(`Sync failed: ${message}`);
      logger.info(`--- sync run failed ---`);
      throw err;
    }
  });
