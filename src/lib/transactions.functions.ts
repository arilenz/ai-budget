import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "#/db";
import { accounts, categories, transactions } from "#/db/schema";
import { requireUser } from "#/lib/auth";

type TransactionInput = {
  accountId: number;
  categoryId: number;
  description: string;
  amount: number;
};
type TransactionUpdateInput = TransactionInput & { id: number };
type IdInput = { id: number };

export type TransactionListInput = {
  accountId?: number;
  categoryId?: number;
  from?: string;
  to?: string;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDayBoundary(yyyyMmDd: string, boundary: "start" | "end"): Date {
  const suffix = boundary === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
  return new Date(`${yyyyMmDd}${suffix}`);
}

function parseListInput(data: unknown): TransactionListInput {
  if (data == null) return {};
  if (typeof data !== "object") throw new Error("Invalid filters");
  const d = data as Record<string, unknown>;
  const out: TransactionListInput = {};
  if (typeof d.accountId === "number") out.accountId = d.accountId;
  if (typeof d.categoryId === "number") out.categoryId = d.categoryId;
  if (typeof d.from === "string" && DATE_PATTERN.test(d.from)) out.from = d.from;
  if (typeof d.to === "string" && DATE_PATTERN.test(d.to)) out.to = d.to;
  return out;
}

function parseInput(data: unknown): TransactionInput {
  if (!data || typeof data !== "object") throw new Error("Invalid input");
  const d = data as TransactionInput;
  if (typeof d.accountId !== "number") throw new Error("Account is required");
  if (typeof d.categoryId !== "number") throw new Error("Category is required");
  if (typeof d.description !== "string")
    throw new Error("Description is required");
  if (typeof d.amount !== "number" || !Number.isFinite(d.amount))
    throw new Error("Amount must be a number");
  const description = d.description.trim();
  if (!description) throw new Error("Description is required");
  return {
    accountId: d.accountId,
    categoryId: d.categoryId,
    description,
    amount: d.amount,
  };
}

function validateUpdate(data: unknown): TransactionUpdateInput {
  if (
    !data ||
    typeof data !== "object" ||
    typeof (data as TransactionUpdateInput).id !== "number"
  ) {
    throw new Error("Id is required");
  }
  const base = parseInput(data);
  return { ...base, id: (data as TransactionUpdateInput).id };
}

function validateId(data: unknown): IdInput {
  if (
    !data ||
    typeof data !== "object" ||
    typeof (data as IdInput).id !== "number"
  ) {
    throw new Error("Id is required");
  }
  return { id: (data as IdInput).id };
}

async function assertOwned(
  userId: number,
  accountId: number,
  categoryId: number,
) {
  const account = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .get();
  if (!account) throw new Error("Account not found");
  const category = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .get();
  if (!category) throw new Error("Category not found");
}

export const listTransactionsFn = createServerFn({ method: "GET" })
  .inputValidator(parseListInput)
  .handler(async ({ data }) => {
    const user = await requireUser();
    const conditions: Array<SQL> = [eq(transactions.userId, user.id)];
    if (data.accountId !== undefined) {
      conditions.push(eq(transactions.accountId, data.accountId));
    }
    if (data.categoryId !== undefined) {
      conditions.push(eq(transactions.categoryId, data.categoryId));
    }
    if (data.from) {
      conditions.push(
        gte(transactions.createdAt, parseDayBoundary(data.from, "start")),
      );
    }
    if (data.to) {
      conditions.push(
        lte(transactions.createdAt, parseDayBoundary(data.to, "end")),
      );
    }
    return db
      .select({
        id: transactions.id,
        accountId: transactions.accountId,
        categoryId: transactions.categoryId,
        description: transactions.description,
        amount: transactions.amount,
        createdAt: transactions.createdAt,
        updatedAt: transactions.updatedAt,
        accountName: accounts.name,
        categoryName: categories.name,
      })
      .from(transactions)
      .innerJoin(accounts, eq(accounts.id, transactions.accountId))
      .innerJoin(categories, eq(categories.id, transactions.categoryId))
      .where(and(...conditions))
      .orderBy(desc(transactions.createdAt))
      .all();
  });

export const createTransactionFn = createServerFn({ method: "POST" })
  .inputValidator(parseInput)
  .handler(async ({ data }) => {
    const user = await requireUser();
    await assertOwned(user.id, data.accountId, data.categoryId);
    return db
      .insert(transactions)
      .values({ ...data, userId: user.id })
      .returning()
      .get();
  });

export const updateTransactionFn = createServerFn({ method: "POST" })
  .inputValidator(validateUpdate)
  .handler(async ({ data }) => {
    const user = await requireUser();
    await assertOwned(user.id, data.accountId, data.categoryId);
    const updated = await db
      .update(transactions)
      .set({
        accountId: data.accountId,
        categoryId: data.categoryId,
        description: data.description,
        amount: data.amount,
      })
      .where(
        and(eq(transactions.id, data.id), eq(transactions.userId, user.id)),
      )
      .returning()
      .get();
    if (!updated) throw new Error("Transaction not found");
    return updated;
  });

export const deleteTransactionFn = createServerFn({ method: "POST" })
  .inputValidator(validateId)
  .handler(async ({ data }) => {
    const user = await requireUser();
    await db
      .delete(transactions)
      .where(
        and(eq(transactions.id, data.id), eq(transactions.userId, user.id)),
      );
    return { ok: true };
  });
