import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { and, desc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "#/db/index.ts";
import { accounts as accountsTable, ACCOUNT_TYPES } from "#/db/schema.ts";
import { requireAuth, type AuthEnv } from "#/middleware/auth.ts";
import { errorSchema, idParam, okSchema } from "#/schemas/common.ts";

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

export const accounts = new OpenAPIHono<AuthEnv>();
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
      200: {
        description: "Created account",
        content: { "application/json": { schema: accountSchema } },
      },
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
    return c.json(serializeAccount(created), 200);
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
      404: {
        description: "Not found",
        content: { "application/json": { schema: errorSchema } },
      },
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
    if (!updated) throw new HTTPException(404, { message: "Account not found" });
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
      200: {
        description: "Deleted",
        content: { "application/json": { schema: okSchema } },
      },
    },
  }),
  async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("param");
    await db
      .delete(accountsTable)
      .where(
        and(eq(accountsTable.id, id), eq(accountsTable.userId, user.id)),
      );
    return c.json({ ok: true as const }, 200);
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
