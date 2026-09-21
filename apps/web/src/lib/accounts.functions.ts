import { createServerFn } from "@tanstack/react-start";
import { createServerApiClient, unwrap, unwrapEmpty } from "#/lib/api-server";

type AccountInput = { name: string };
type AccountUpdateInput = { id: number; name: string };
type IdInput = { id: number };

function validateAccountInput(data: unknown): AccountInput {
  if (
    !data ||
    typeof data !== "object" ||
    typeof (data as AccountInput).name !== "string"
  ) {
    throw new Error("Name is required");
  }
  const name = (data as AccountInput).name.trim();
  if (!name) throw new Error("Name is required");
  return { name };
}

function validateAccountUpdate(data: unknown): AccountUpdateInput {
  if (
    !data ||
    typeof data !== "object" ||
    typeof (data as AccountUpdateInput).id !== "number" ||
    typeof (data as AccountUpdateInput).name !== "string"
  ) {
    throw new Error("Id and name are required");
  }
  const name = (data as AccountUpdateInput).name.trim();
  if (!name) throw new Error("Name is required");
  return { id: (data as AccountUpdateInput).id, name };
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

export const listAccountsFn = createServerFn({ method: "GET" }).handler(
  async () => unwrap(await createServerApiClient().GET("/accounts"), "Failed to list accounts"),
);

export const createAccountFn = createServerFn({ method: "POST" })
  .inputValidator(validateAccountInput)
  .handler(async ({ data }) =>
    unwrap(
      await createServerApiClient().POST("/accounts", { body: data }),
      "Failed to create account",
    ),
  );

export const updateAccountFn = createServerFn({ method: "POST" })
  .inputValidator(validateAccountUpdate)
  .handler(async ({ data }) =>
    unwrap(
      await createServerApiClient().PATCH("/accounts/{id}", {
        params: { path: { id: data.id } },
        body: { name: data.name },
      }),
      "Failed to update account",
    ),
  );

export const deleteAccountFn = createServerFn({ method: "POST" })
  .inputValidator(validateId)
  .handler(async ({ data }) =>
    unwrapEmpty(
      await createServerApiClient().DELETE("/accounts/{id}", {
        params: { path: { id: data.id } },
      }),
      "Failed to delete account",
    ),
  );
