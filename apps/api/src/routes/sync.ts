import { createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { db } from "#/db/index.ts";
import { accounts as accountsTable } from "#/db/schema.ts";
import { ApiError } from "#/lib/api-error.ts";
import { createRouter } from "#/lib/router.ts";
import { syncMonoAccount } from "#/lib/sync.ts";
import { createSyncLogger } from "#/lib/sync-logger.ts";
import { requireAuth } from "#/middleware/auth.ts";
import {
  errorResponse,
  idParam,
  unauthenticatedResponse,
  validationFailedResponse,
} from "#/schemas/common.ts";

const syncResultSchema = z
  .object({
    inserted: z.number().int(),
    fetched: z.number().int(),
    apiCalls: z.number().int(),
    rangeFrom: z.string().datetime(),
    rangeTo: z.string().datetime(),
  })
  .openapi("SyncResult");

export const sync = createRouter();
sync.use("*", requireAuth);

sync.openapi(
  createRoute({
    method: "post",
    path: "/mono-account/{id}",
    tags: ["sync"],
    security: [{ bearerAuth: [] }],
    request: { params: idParam },
    responses: {
      200: {
        description: "Sync result",
        content: { "application/json": { schema: syncResultSchema } },
      },
      400: validationFailedResponse,
      401: unauthenticatedResponse,
      404: errorResponse("Account not found"),
      500: errorResponse("Sync failed"),
    },
  }),
  async (c) => {
    const user = c.get("user");
    const { id: accountId } = c.req.valid("param");
    const account = await db
      .select({ id: accountsTable.id, userId: accountsTable.userId })
      .from(accountsTable)
      .where(eq(accountsTable.id, accountId))
      .get();
    if (!account || account.userId !== user.id) {
      throw ApiError.notFound("Account not found");
    }
    const logger = createSyncLogger({ source: "ui", accountId });
    logger.info(`--- sync run start ---`);
    const startedAt = Date.now();
    try {
      const result = await syncMonoAccount(accountId, {
        log: (message) => logger.info(message),
      });
      logger.info(
        `Result: inserted=${result.inserted} fetched=${result.fetched} apiCalls=${result.apiCalls} totalMs=${Date.now() - startedAt}`,
      );
      logger.info(`--- sync run ok ---`);
      return c.json(
        {
          inserted: result.inserted,
          fetched: result.fetched,
          apiCalls: result.apiCalls,
          rangeFrom: result.rangeFrom.toISOString(),
          rangeTo: result.rangeTo.toISOString(),
        },
        200,
      );
    } catch (err) {
      const message =
        err instanceof Error ? (err.stack ?? err.message) : String(err);
      logger.error(`Sync failed: ${message}`);
      logger.info(`--- sync run failed ---`);
      throw ApiError.internal("Sync failed");
    }
  },
);
