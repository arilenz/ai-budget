import { createServerFn } from "@tanstack/react-start";
import { createServerApiClient, unwrap } from "#/lib/api-server";

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

export const listTransactionsFn = createServerFn({ method: "GET" })
  .inputValidator(parseListInput)
  .handler(async ({ data }) =>
    unwrap(
      await createServerApiClient().GET("/transactions", {
        params: { query: data },
      }),
      "Failed to list transactions",
    ),
  );

export const createTransactionFn = createServerFn({ method: "POST" })
  .inputValidator(parseInput)
  .handler(async ({ data }) =>
    unwrap(
      await createServerApiClient().POST("/transactions", { body: data }),
      "Failed to create transaction",
    ),
  );

export const updateTransactionFn = createServerFn({ method: "POST" })
  .inputValidator(validateUpdate)
  .handler(async ({ data }) => {
    const { id, ...body } = data;
    return unwrap(
      await createServerApiClient().PATCH("/transactions/{id}", {
        params: { path: { id } },
        body,
      }),
      "Failed to update transaction",
    );
  });

export const deleteTransactionFn = createServerFn({ method: "POST" })
  .inputValidator(validateId)
  .handler(async ({ data }) =>
    unwrap(
      await createServerApiClient().DELETE("/transactions/{id}", {
        params: { path: { id: data.id } },
      }),
      "Failed to delete transaction",
    ),
  );
