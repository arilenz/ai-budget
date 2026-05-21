import { createServerFn } from "@tanstack/react-start";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "#/db";
import { categories, transactions } from "#/db/schema";
import { requireUser } from "#/lib/auth";

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

type BreakdownInput = { month: string };

export type CategoryBreakdownRow = {
  categoryId: number;
  categoryName: string;
  total: number;
  txCount: number;
};

function parseMonthInput(data: unknown): BreakdownInput {
  if (!data || typeof data !== "object") throw new Error("month is required");
  const month = (data as { month: unknown }).month;
  if (typeof month !== "string" || !MONTH_PATTERN.test(month)) {
    throw new Error("month must be in YYYY-MM format");
  }
  return { month };
}

function monthBoundaries(month: string): { from: Date; toExclusive: Date } {
  const [year, monthNum] = month.split("-").map(Number);
  return {
    from: new Date(Date.UTC(year, monthNum - 1, 1)),
    toExclusive: new Date(Date.UTC(year, monthNum, 1)),
  };
}

export const monthlyCategoryBreakdownFn = createServerFn({ method: "GET" })
  .inputValidator(parseMonthInput)
  .handler(async ({ data }): Promise<Array<CategoryBreakdownRow>> => {
    const user = await requireUser();
    const { from, toExclusive } = monthBoundaries(data.month);
    return db
      .select({
        categoryId: categories.id,
        categoryName: categories.name,
        total: sql<number>`SUM(${transactions.amount})`.as("total"),
        txCount: sql<number>`COUNT(*)`.as("tx_count"),
      })
      .from(transactions)
      .innerJoin(categories, eq(categories.id, transactions.categoryId))
      .where(
        and(
          eq(transactions.userId, user.id),
          gte(transactions.createdAt, from),
          lt(transactions.createdAt, toExclusive),
        ),
      )
      .groupBy(categories.id, categories.name)
      .all();
  });
