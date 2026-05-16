import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import { db } from "#/db";
import { accounts } from "#/db/schema";
import { requireUser } from "#/lib/auth";

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
  async () => {
    const user = await requireUser();
    return db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, user.id))
      .orderBy(desc(accounts.createdAt))
      .all();
  },
);

export const createAccountFn = createServerFn({ method: "POST" })
  .inputValidator(validateAccountInput)
  .handler(async ({ data }) => {
    const user = await requireUser();
    return db
      .insert(accounts)
      .values({ userId: user.id, name: data.name })
      .returning()
      .get();
  });

export const updateAccountFn = createServerFn({ method: "POST" })
  .inputValidator(validateAccountUpdate)
  .handler(async ({ data }) => {
    const user = await requireUser();
    const updated = await db
      .update(accounts)
      .set({ name: data.name })
      .where(and(eq(accounts.id, data.id), eq(accounts.userId, user.id)))
      .returning()
      .get();
    if (!updated) throw new Error("Account not found");
    return updated;
  });

export const deleteAccountFn = createServerFn({ method: "POST" })
  .inputValidator(validateId)
  .handler(async ({ data }) => {
    const user = await requireUser();
    await db
      .delete(accounts)
      .where(and(eq(accounts.id, data.id), eq(accounts.userId, user.id)));
    return { ok: true };
  });
