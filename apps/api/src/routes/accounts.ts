import { createRoute, z } from "@hono/zod-openapi";
import { and, desc, eq } from "drizzle-orm";
import { db } from "#/db/index.ts";
import {
  accounts as accountsTable,
  ACCOUNT_TYPES,
  transactions as transactionsTable,
} from "#/db/schema.ts";
import { ApiError } from "#/lib/api-error.ts";
import { createRouter } from "#/lib/router.ts";
import { requireAuth } from "#/middleware/auth.ts";
import {
  createdResponse,
  deletedResponse,
  errorResponse,
  idParam,
  unauthenticatedResponse,
  validationFailedResponse,
} from "#/schemas/common.ts";

const accountSchema = z
  .object({
    id: z.number().int(),
    userId: z.number().int(),
    name: z.string(),
    type: z.enum(ACCOUNT_TYPES),
    monoAccountId: z.string().nullable(),
    lastSyncedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Account");

const accountInputSchema = z.object({
  name: z.string().min(1),
});

export const accounts = createRouter();
accounts.use("*", requireAuth);

accounts.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["accounts"],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: "List accounts",
        content: { "application/json": { schema: z.array(accountSchema) } },
      },
      401: unauthenticatedResponse,
    },
  }),
  async (c) => {
    const user = c.get("user");
    const rows = await db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.userId, user.id))
      .orderBy(desc(accountsTable.createdAt))
      .all();
    return c.json(rows.map(serializeAccount), 200);
  },
);

accounts.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["accounts"],
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { "application/json": { schema: accountInputSchema } } },
    },
    responses: {
      201: createdResponse("Created account", accountSchema),
      400: validationFailedResponse,
      401: unauthenticatedResponse,
    },
  }),
  async (c) => {
    const user = c.get("user");
    const body = c.req.valid("json");
    const created = await db
      .insert(accountsTable)
      .values({ userId: user.id, name: body.name.trim(), type: "cash" })
      .returning()
      .get();
    c.header("Location", `/accounts/${created.id}`);
    return c.json(serializeAccount(created), 201);
  },
);

accounts.openapi(
  createRoute({
    method: "get",
    path: "/{id}",
    tags: ["accounts"],
    security: [{ bearerAuth: [] }],
    request: { params: idParam },
    responses: {
      200: {
        description: "Account",
        content: { "application/json": { schema: accountSchema } },
      },
      400: validationFailedResponse,
      401: unauthenticatedResponse,
      404: errorResponse("Account not found"),
    },
  }),
  async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("param");
    const account = await db
      .select()
      .from(accountsTable)
      .where(
        and(eq(accountsTable.id, id), eq(accountsTable.userId, user.id)),
      )
      .get();
    if (!account) throw ApiError.notFound("Account not found");
    return c.json(serializeAccount(account), 200);
  },
);

accounts.openapi(
  createRoute({
    method: "patch",
    path: "/{id}",
    tags: ["accounts"],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParam,
      body: { content: { "application/json": { schema: accountInputSchema } } },
    },
    responses: {
      200: {
        description: "Updated account",
        content: { "application/json": { schema: accountSchema } },
      },
      400: validationFailedResponse,
      401: unauthenticatedResponse,
      404: errorResponse("Account not found"),
    },
  }),
  async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const updated = await db
      .update(accountsTable)
      .set({ name: body.name.trim() })
      .where(
        and(eq(accountsTable.id, id), eq(accountsTable.userId, user.id)),
      )
      .returning()
      .get();
    if (!updated) throw ApiError.notFound("Account not found");
    return c.json(serializeAccount(updated), 200);
  },
);

accounts.openapi(
  createRoute({
    method: "delete",
    path: "/{id}",
    tags: ["accounts"],
    security: [{ bearerAuth: [] }],
    request: { params: idParam },
    responses: {
      204: deletedResponse,
      400: validationFailedResponse,
      401: unauthenticatedResponse,
      404: errorResponse("Account not found"),
      409: errorResponse("Account still has transactions"),
    },
  }),
  async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("param");
    const owned = and(
      eq(accountsTable.id, id),
      eq(accountsTable.userId, user.id),
    );
    const account = await db
      .select({ id: accountsTable.id })
      .from(accountsTable)
      .where(owned)
      .get();
    if (!account) throw ApiError.notFound("Account not found");
    const transaction = await db
      .select({ id: transactionsTable.id })
      .from(transactionsTable)
      .where(eq(transactionsTable.accountId, id))
      .limit(1)
      .get();
    if (transaction) {
      throw new ApiError(
        409,
        "account_has_transactions",
        "Account still has transactions",
      );
    }
    await db.delete(accountsTable).where(owned);
    return c.body(null, 204);
  },
);

type AccountRow = typeof accountsTable.$inferSelect;

function serializeAccount(row: AccountRow) {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    type: row.type,
    monoAccountId: row.monoAccountId,
    lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
