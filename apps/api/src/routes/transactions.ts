import { createRoute, z } from "@hono/zod-openapi";
import { and, desc, eq, gte, isNull, lte, type SQL } from "drizzle-orm";
import { db } from "#/db/index.ts";
import {
  accounts as accountsTable,
  categories as categoriesTable,
  rules as rulesTable,
  transactions as transactionsTable,
} from "#/db/schema.ts";
import { ApiError } from "#/lib/api-error.ts";
import { createRouter } from "#/lib/router.ts";
import { inferRuleConditions, type InferredRuleConditions } from "#/lib/rules.ts";
import { requireAuth } from "#/middleware/auth.ts";
import {
  errorResponse,
  idParam,
  okSchema,
  unauthenticatedResponse,
  validationFailedResponse,
} from "#/schemas/common.ts";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const transactionSchema = z
  .object({
    id: z.number().int(),
    accountId: z.number().int(),
    categoryId: z.number().int(),
    description: z.string(),
    amount: z.number(),
    accountName: z.string(),
    categoryName: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Transaction");

const transactionInputSchema = z.object({
  accountId: z.number().int().positive(),
  categoryId: z.number().int().positive(),
  description: z.string().min(1),
  amount: z.number().finite(),
});

const listQuerySchema = z.object({
  accountId: z.coerce.number().int().positive().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  from: z.string().regex(DATE_PATTERN).optional(),
  to: z.string().regex(DATE_PATTERN).optional(),
});

export const transactions = createRouter();
transactions.use("*", requireAuth);

transactions.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["transactions"],
    security: [{ bearerAuth: [] }],
    request: { query: listQuerySchema },
    responses: {
      200: {
        description: "List transactions",
        content: { "application/json": { schema: z.array(transactionSchema) } },
      },
      400: validationFailedResponse,
      401: unauthenticatedResponse,
    },
  }),
  async (c) => {
    const user = c.get("user");
    const q = c.req.valid("query");
    const conditions: Array<SQL> = [eq(transactionsTable.userId, user.id)];
    if (q.accountId !== undefined) {
      conditions.push(eq(transactionsTable.accountId, q.accountId));
    }
    if (q.categoryId !== undefined) {
      conditions.push(eq(transactionsTable.categoryId, q.categoryId));
    }
    if (q.from) {
      conditions.push(
        gte(transactionsTable.createdAt, parseDayBoundary(q.from, "start")),
      );
    }
    if (q.to) {
      conditions.push(
        lte(transactionsTable.createdAt, parseDayBoundary(q.to, "end")),
      );
    }
    const rows = await db
      .select({
        id: transactionsTable.id,
        accountId: transactionsTable.accountId,
        categoryId: transactionsTable.categoryId,
        description: transactionsTable.description,
        amount: transactionsTable.amount,
        createdAt: transactionsTable.createdAt,
        updatedAt: transactionsTable.updatedAt,
        accountName: accountsTable.name,
        categoryName: categoriesTable.name,
      })
      .from(transactionsTable)
      .innerJoin(
        accountsTable,
        eq(accountsTable.id, transactionsTable.accountId),
      )
      .innerJoin(
        categoriesTable,
        eq(categoriesTable.id, transactionsTable.categoryId),
      )
      .where(and(...conditions))
      .orderBy(desc(transactionsTable.createdAt))
      .all();
    return c.json(
      rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      200,
    );
  },
);

transactions.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["transactions"],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: { "application/json": { schema: transactionInputSchema } },
      },
    },
    responses: {
      200: {
        description: "Created transaction",
        content: { "application/json": { schema: transactionSchema } },
      },
      400: validationFailedResponse,
      401: unauthenticatedResponse,
      404: errorResponse("Account or category not found"),
    },
  }),
  async (c) => {
    const user = c.get("user");
    const body = c.req.valid("json");
    await assertOwned(user.id, body.accountId, body.categoryId);
    const description = body.description.trim();
    const created = await db
      .insert(transactionsTable)
      .values({
        userId: user.id,
        accountId: body.accountId,
        categoryId: body.categoryId,
        description,
        amount: body.amount,
        originalCategoryId: body.categoryId,
        originalDescription: description,
        originalAmount: body.amount,
      })
      .returning()
      .get();
    return c.json(await serializeWithNames(created), 200);
  },
);

transactions.openapi(
  createRoute({
    method: "patch",
    path: "/{id}",
    tags: ["transactions"],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParam,
      body: {
        content: { "application/json": { schema: transactionInputSchema } },
      },
    },
    responses: {
      200: {
        description: "Updated transaction",
        content: { "application/json": { schema: transactionSchema } },
      },
      400: validationFailedResponse,
      401: unauthenticatedResponse,
      404: errorResponse("Transaction, account or category not found"),
    },
  }),
  async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    await assertOwned(user.id, body.accountId, body.categoryId);
    const existing = await db
      .select({
        categoryId: transactionsTable.categoryId,
        mcc: transactionsTable.mcc,
        counterIban: transactionsTable.counterIban,
        description: transactionsTable.description,
      })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.id, id),
          eq(transactionsTable.userId, user.id),
        ),
      )
      .get();
    if (!existing) throw ApiError.notFound("Transaction not found");

    const description = body.description.trim();
    const updated = await db
      .update(transactionsTable)
      .set({
        accountId: body.accountId,
        categoryId: body.categoryId,
        description,
        amount: body.amount,
      })
      .where(
        and(
          eq(transactionsTable.id, id),
          eq(transactionsTable.userId, user.id),
        ),
      )
      .returning()
      .get();
    if (!updated) throw ApiError.notFound("Transaction not found");

    if (existing.categoryId !== body.categoryId) {
      await createInferredRule(user.id, body.categoryId, {
        mcc: existing.mcc,
        counterIban: existing.counterIban,
        description,
      });
    }
    return c.json(await serializeWithNames(updated), 200);
  },
);

transactions.openapi(
  createRoute({
    method: "delete",
    path: "/{id}",
    tags: ["transactions"],
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
      .delete(transactionsTable)
      .where(
        and(
          eq(transactionsTable.id, id),
          eq(transactionsTable.userId, user.id),
        ),
      );
    return c.json({ ok: true as const }, 200);
  },
);

function parseDayBoundary(yyyyMmDd: string, boundary: "start" | "end"): Date {
  const suffix = boundary === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
  return new Date(`${yyyyMmDd}${suffix}`);
}

async function assertOwned(
  userId: number,
  accountId: number,
  categoryId: number,
) {
  const account = await db
    .select({ id: accountsTable.id })
    .from(accountsTable)
    .where(and(eq(accountsTable.id, accountId), eq(accountsTable.userId, userId)))
    .get();
  if (!account) throw ApiError.notFound("Account not found");
  const category = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(
      and(eq(categoriesTable.id, categoryId), eq(categoriesTable.userId, userId)),
    )
    .get();
  if (!category) throw ApiError.notFound("Category not found");
}

async function createInferredRule(
  userId: number,
  categoryId: number,
  tx: { mcc: number | null; counterIban: string | null; description: string },
) {
  const conditions = inferRuleConditions(tx);
  if (!hasAnyCondition(conditions)) return;
  const duplicate = await findEquivalentRule(userId, categoryId, conditions);
  if (duplicate) return;
  await db.insert(rulesTable).values({
    userId,
    categoryId,
    mcc: conditions.mcc,
    counterIban: conditions.counterIban,
    descriptionPattern: conditions.descriptionPattern,
  });
}

function hasAnyCondition(c: InferredRuleConditions): boolean {
  return (
    c.mcc !== null || c.counterIban !== null || c.descriptionPattern !== null
  );
}

async function findEquivalentRule(
  userId: number,
  categoryId: number,
  conditions: InferredRuleConditions,
) {
  const where = and(
    eq(rulesTable.userId, userId),
    eq(rulesTable.categoryId, categoryId),
    conditions.mcc === null
      ? isNull(rulesTable.mcc)
      : eq(rulesTable.mcc, conditions.mcc),
    conditions.counterIban === null
      ? isNull(rulesTable.counterIban)
      : eq(rulesTable.counterIban, conditions.counterIban),
    conditions.descriptionPattern === null
      ? isNull(rulesTable.descriptionPattern)
      : eq(rulesTable.descriptionPattern, conditions.descriptionPattern),
  );
  return db.select({ id: rulesTable.id }).from(rulesTable).where(where).get();
}

async function serializeWithNames(
  row: typeof transactionsTable.$inferSelect,
) {
  const names = await db
    .select({
      accountName: accountsTable.name,
      categoryName: categoriesTable.name,
    })
    .from(transactionsTable)
    .innerJoin(
      accountsTable,
      eq(accountsTable.id, transactionsTable.accountId),
    )
    .innerJoin(
      categoriesTable,
      eq(categoriesTable.id, transactionsTable.categoryId),
    )
    .where(eq(transactionsTable.id, row.id))
    .get();
  return {
    id: row.id,
    accountId: row.accountId,
    categoryId: row.categoryId,
    description: row.description,
    amount: row.amount,
    accountName: names?.accountName ?? "",
    categoryName: names?.categoryName ?? "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
