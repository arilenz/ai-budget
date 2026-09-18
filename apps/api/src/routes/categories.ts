import { createRoute, z } from "@hono/zod-openapi";
import { and, desc, eq } from "drizzle-orm";
import { db } from "#/db/index.ts";
import { categories as categoriesTable } from "#/db/schema.ts";
import { ApiError } from "#/lib/api-error.ts";
import { createRouter } from "#/lib/router.ts";
import { requireAuth } from "#/middleware/auth.ts";
import {
  errorResponse,
  idParam,
  okSchema,
  unauthenticatedResponse,
  validationFailedResponse,
} from "#/schemas/common.ts";

const categorySchema = z
  .object({
    id: z.number().int(),
    userId: z.number().int(),
    name: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Category");

const categoryInputSchema = z.object({
  name: z.string().min(1),
});

export const categories = createRouter();
categories.use("*", requireAuth);

categories.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["categories"],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: "List categories",
        content: { "application/json": { schema: z.array(categorySchema) } },
      },
      401: unauthenticatedResponse,
    },
  }),
  async (c) => {
    const user = c.get("user");
    const rows = await db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.userId, user.id))
      .orderBy(desc(categoriesTable.createdAt))
      .all();
    return c.json(rows.map(serializeCategory), 200);
  },
);

categories.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["categories"],
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { "application/json": { schema: categoryInputSchema } } },
    },
    responses: {
      200: {
        description: "Created category",
        content: { "application/json": { schema: categorySchema } },
      },
      400: validationFailedResponse,
      401: unauthenticatedResponse,
    },
  }),
  async (c) => {
    const user = c.get("user");
    const body = c.req.valid("json");
    const created = await db
      .insert(categoriesTable)
      .values({ userId: user.id, name: body.name.trim() })
      .returning()
      .get();
    return c.json(serializeCategory(created), 200);
  },
);

categories.openapi(
  createRoute({
    method: "patch",
    path: "/{id}",
    tags: ["categories"],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParam,
      body: { content: { "application/json": { schema: categoryInputSchema } } },
    },
    responses: {
      200: {
        description: "Updated category",
        content: { "application/json": { schema: categorySchema } },
      },
      400: validationFailedResponse,
      401: unauthenticatedResponse,
      404: errorResponse("Category not found"),
    },
  }),
  async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const updated = await db
      .update(categoriesTable)
      .set({ name: body.name.trim() })
      .where(
        and(eq(categoriesTable.id, id), eq(categoriesTable.userId, user.id)),
      )
      .returning()
      .get();
    if (!updated) throw ApiError.notFound("Category not found");
    return c.json(serializeCategory(updated), 200);
  },
);

categories.openapi(
  createRoute({
    method: "delete",
    path: "/{id}",
    tags: ["categories"],
    security: [{ bearerAuth: [] }],
    request: { params: idParam },
    responses: {
      200: {
        description: "Deleted",
        content: { "application/json": { schema: okSchema } },
      },
      400: validationFailedResponse,
      401: unauthenticatedResponse,
    },
  }),
  async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("param");
    await db
      .delete(categoriesTable)
      .where(
        and(eq(categoriesTable.id, id), eq(categoriesTable.userId, user.id)),
      );
    return c.json({ ok: true as const }, 200);
  },
);

type CategoryRow = typeof categoriesTable.$inferSelect;

function serializeCategory(row: CategoryRow) {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
