import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "#/db/index.ts";
import { rules } from "#/db/schema.ts";
import { api } from "./helpers/api.ts";
import { createUser, type TestUser } from "./helpers/users.ts";

type Transaction = {
  readonly id: number;
  readonly accountId: number;
  readonly categoryId: number;
  readonly description: string;
  readonly amount: number;
  readonly accountName: string;
  readonly categoryName: string;
};

type ErrorBody = {
  readonly error: { readonly code: string; readonly message: string };
};

type Created = { readonly id: number };

const createAccount = async (user: TestUser, name = "Wallet") =>
  (await user.api.post<Created>("/accounts", { name })).body.id;

const createCategory = async (user: TestUser, name = "Food") =>
  (await user.api.post<Created>("/categories", { name })).body.id;

const createTransaction = async (
  user: TestUser,
  fields: Partial<Omit<Transaction, "id">> = {},
) => {
  const accountId = fields.accountId ?? (await createAccount(user));
  const categoryId = fields.categoryId ?? (await createCategory(user));
  const response = await user.api.post<Transaction>("/transactions", {
    accountId,
    categoryId,
    description: fields.description ?? "Corner shop",
    amount: fields.amount ?? -10,
  });
  return response.body;
};

// There is no rules endpoint yet, so inferred rules are read straight from
// this file's database.
const rulesOf = (user: TestUser) =>
  db.select().from(rules).where(eq(rules.userId, user.id)).all();

describe("creating transactions", () => {
  it("returns 201 with the transaction and its Location", async () => {
    const user = await createUser();
    const accountId = await createAccount(user, "Card");
    const categoryId = await createCategory(user, "Groceries");

    const response = await user.api.post<Transaction>("/transactions", {
      accountId,
      categoryId,
      description: "  Market  ",
      amount: -25.5,
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      accountId,
      categoryId,
      description: "Market",
      amount: -25.5,
      accountName: "Card",
      categoryName: "Groceries",
    });
    expect(response.headers.get("location")).toBe(
      `/transactions/${response.body.id}`,
    );
  });

  it("refuses an account that belongs to someone else", async () => {
    const user = await createUser();
    const stranger = await createUser();

    const response = await user.api.post<ErrorBody>("/transactions", {
      accountId: await createAccount(stranger),
      categoryId: await createCategory(user),
      description: "Sneaky",
      amount: -1,
    });

    expect(response.status).toBe(404);
    expect(response.body.error.message).toBe("Account not found");
  });
});

describe("listing transactions", () => {
  it("lists only the caller's transactions", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const mine = await createTransaction(owner);
    await createTransaction(stranger);

    const response = await owner.api.get<readonly Transaction[]>(
      "/transactions",
    );

    expect(response.status).toBe(200);
    expect(response.body.map((transaction) => transaction.id)).toEqual([
      mine.id,
    ]);
  });
});

describe("updating transactions", () => {
  it("changes only the fields sent", async () => {
    const user = await createUser();
    const created = await createTransaction(user, {
      description: "Bakery",
      amount: -7,
    });

    const response = await user.api.patch<Transaction>(
      `/transactions/${created.id}`,
      { amount: -8 },
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      accountId: created.accountId,
      categoryId: created.categoryId,
      description: "Bakery",
      amount: -8,
    });
  });

  it("moves a transaction to another account", async () => {
    const user = await createUser();
    const created = await createTransaction(user);
    const otherAccountId = await createAccount(user, "Savings");

    const response = await user.api.patch<Transaction>(
      `/transactions/${created.id}`,
      { accountId: otherAccountId },
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      accountId: otherAccountId,
      accountName: "Savings",
      categoryId: created.categoryId,
    });
  });

  it("rejects an empty body as validation_failed", async () => {
    const user = await createUser();
    const created = await createTransaction(user);

    const response = await user.api.patch<ErrorBody>(
      `/transactions/${created.id}`,
      {},
    );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("validation_failed");
  });

  it("refuses a category that belongs to someone else", async () => {
    const user = await createUser();
    const stranger = await createUser();
    const created = await createTransaction(user);

    const response = await user.api.patch<ErrorBody>(
      `/transactions/${created.id}`,
      { categoryId: await createCategory(stranger) },
    );

    expect(response.status).toBe(404);
    expect(response.body.error.message).toBe("Category not found");
  });

  it("does not let one user update another user's transaction", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const created = await createTransaction(owner);

    const response = await stranger.api.patch<ErrorBody>(
      `/transactions/${created.id}`,
      { amount: 0 },
    );

    expect(response.status).toBe(404);
    expect(response.body.error.message).toBe("Transaction not found");
  });

  it("infers a rule from the stored description when only the category changes", async () => {
    const user = await createUser();
    const created = await createTransaction(user, { description: "Coffee Bar" });
    const categoryId = await createCategory(user, "Coffee");

    const response = await user.api.patch(`/transactions/${created.id}`, {
      categoryId,
    });

    expect(response.status).toBe(200);
    expect(rulesOf(user)).toMatchObject([
      { categoryId, descriptionPattern: "coffee bar" },
    ]);
  });

  it("infers the rule from the new description when both are sent", async () => {
    const user = await createUser();
    const created = await createTransaction(user, { description: "Shop" });
    const categoryId = await createCategory(user, "Books");

    await user.api.patch(`/transactions/${created.id}`, {
      categoryId,
      description: "Book Shop",
    });

    expect(rulesOf(user)).toMatchObject([
      { categoryId, descriptionPattern: "book shop" },
    ]);
  });

  it("does not infer a rule when the category is not sent", async () => {
    const user = await createUser();
    const created = await createTransaction(user);

    await user.api.patch(`/transactions/${created.id}`, {
      description: "Renamed",
    });

    expect(rulesOf(user)).toEqual([]);
  });

  it("does not infer a rule when the category is sent unchanged", async () => {
    const user = await createUser();
    const created = await createTransaction(user);

    await user.api.patch(`/transactions/${created.id}`, {
      categoryId: created.categoryId,
    });

    expect(rulesOf(user)).toEqual([]);
  });
});

describe("deleting transactions", () => {
  it("deletes a transaction", async () => {
    const user = await createUser();
    const created = await createTransaction(user);

    const response = await user.api.delete(`/transactions/${created.id}`);

    expect(response.status).toBe(204);
    expect(response.body).toBeUndefined();
    const remaining = await user.api.get<readonly Transaction[]>(
      "/transactions",
    );
    expect(remaining.body).toEqual([]);
  });

  it("answers deleting a missing transaction with not_found", async () => {
    const user = await createUser();

    const response = await user.api.delete<ErrorBody>("/transactions/999999");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("not_found");
  });

  it("does not let one user delete another user's transaction", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const created = await createTransaction(owner);

    const response = await stranger.api.delete(`/transactions/${created.id}`);

    expect(response.status).toBe(404);
    const remaining = await owner.api.get<readonly Transaction[]>(
      "/transactions",
    );
    expect(remaining.body).toHaveLength(1);
  });

  it("lets the account and category be deleted once it is gone", async () => {
    const user = await createUser();
    const created = await createTransaction(user);
    await user.api.delete(`/transactions/${created.id}`);

    const account = await user.api.delete(`/accounts/${created.accountId}`);
    const category = await user.api.delete(
      `/categories/${created.categoryId}`,
    );

    expect(account.status).toBe(204);
    expect(category.status).toBe(204);
  });
});

describe("transactions auth", () => {
  it("rejects requests without a token", async () => {
    const response = await api.get("/transactions");

    expect(response.status).toBe(401);
  });
});
