import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "#/db/index.ts";
import { accounts as accountsTable } from "#/db/schema.ts";
import { syncMonoAccount } from "#/lib/sync.ts";
import { createSyncLogger } from "#/lib/sync-logger.ts";
import { requireAuth, type AuthEnv } from "#/middleware/auth.ts";
import { errorSchema, idParam } from "#/schemas/common.ts";

const syncResultSchema = z
  .object({
    inserted: z.number().int(),
    fetched: z.number().int(),
    apiCalls: z.number().int(),
    rangeFrom: z.string().datetime(),
    rangeTo: z.string().datetime(),
  })
  .openapi("SyncResult");

export const sync = new OpenAPIHono<AuthEnv>();
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
      404: {
        description: "Account not found",
        content: { "application/json": { schema: errorSchema } },
      },
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
      throw new HTTPException(404, { message: "Account not found" });
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
      throw new HTTPException(500, {
        message: err instanceof Error ? err.message : "Sync failed",
      });
    }
  },
);
