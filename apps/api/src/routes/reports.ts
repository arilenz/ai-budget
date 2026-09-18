import { createRoute, z } from "@hono/zod-openapi";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "#/db/index.ts";
import { categories as categoriesTable, transactions as transactionsTable } from "#/db/schema.ts";
import { createRouter } from "#/lib/router.ts";
import { requireAuth } from "#/middleware/auth.ts";
import {
  unauthenticatedResponse,
  validationFailedResponse,
} from "#/schemas/common.ts";

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

const breakdownRowSchema = z
  .object({
    categoryId: z.number().int(),
    categoryName: z.string(),
    total: z.number(),
    txCount: z.number().int(),
  })
  .openapi("CategoryBreakdownRow");

const monthQuerySchema = z.object({
  month: z.string().regex(MONTH_PATTERN),
});

export const reports = createRouter();
reports.use("*", requireAuth);

reports.openapi(
  createRoute({
    method: "get",
    path: "/monthly-breakdown",
    tags: ["reports"],
    security: [{ bearerAuth: [] }],
    request: { query: monthQuerySchema },
    responses: {
      200: {
        description: "Spending by category for the given month",
        content: {
          "application/json": { schema: z.array(breakdownRowSchema) },
        },
      },
      400: validationFailedResponse,
      401: unauthenticatedResponse,
    },
  }),
  async (c) => {
    const user = c.get("user");
    const { month } = c.req.valid("query");
    const { from, toExclusive } = monthBoundaries(month);
    const rows = await db
      .select({
        categoryId: categoriesTable.id,
        categoryName: categoriesTable.name,
        total: sql<number>`SUM(${transactionsTable.amount})`.as("total"),
        txCount: sql<number>`COUNT(*)`.as("tx_count"),
      })
      .from(transactionsTable)
      .innerJoin(
        categoriesTable,
        eq(categoriesTable.id, transactionsTable.categoryId),
      )
      .where(
        and(
          eq(transactionsTable.userId, user.id),
          gte(transactionsTable.createdAt, from),
          lt(transactionsTable.createdAt, toExclusive),
        ),
      )
      .groupBy(categoriesTable.id, categoriesTable.name)
      .all();
    return c.json(rows, 200);
  },
);

function monthBoundaries(month: string): { from: Date; toExclusive: Date } {
  const [year, monthNum] = month.split("-").map(Number);
  return {
    from: new Date(Date.UTC(year, monthNum - 1, 1)),
    toExclusive: new Date(Date.UTC(year, monthNum, 1)),
  };
}
