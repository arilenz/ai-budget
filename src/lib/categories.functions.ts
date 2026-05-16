import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import { db } from "#/db";
import { categories } from "#/db/schema";
import { requireUser } from "#/lib/auth";

type CategoryInput = { name: string };
type CategoryUpdateInput = { id: number; name: string };
type IdInput = { id: number };

function validateCategoryInput(data: unknown): CategoryInput {
  if (
    !data ||
    typeof data !== "object" ||
    typeof (data as CategoryInput).name !== "string"
  ) {
    throw new Error("Name is required");
  }
  const name = (data as CategoryInput).name.trim();
  if (!name) throw new Error("Name is required");
  return { name };
}

function validateCategoryUpdate(data: unknown): CategoryUpdateInput {
  if (
    !data ||
    typeof data !== "object" ||
    typeof (data as CategoryUpdateInput).id !== "number" ||
    typeof (data as CategoryUpdateInput).name !== "string"
  ) {
    throw new Error("Id and name are required");
  }
  const name = (data as CategoryUpdateInput).name.trim();
  if (!name) throw new Error("Name is required");
  return { id: (data as CategoryUpdateInput).id, name };
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

export const listCategoriesFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const user = await requireUser();
    return db
      .select()
      .from(categories)
      .where(eq(categories.userId, user.id))
      .orderBy(desc(categories.createdAt))
      .all();
  },
);

export const createCategoryFn = createServerFn({ method: "POST" })
  .inputValidator(validateCategoryInput)
  .handler(async ({ data }) => {
    const user = await requireUser();
    return db
      .insert(categories)
      .values({ userId: user.id, name: data.name })
      .returning()
      .get();
  });

export const updateCategoryFn = createServerFn({ method: "POST" })
  .inputValidator(validateCategoryUpdate)
  .handler(async ({ data }) => {
    const user = await requireUser();
    const updated = await db
      .update(categories)
      .set({ name: data.name })
      .where(and(eq(categories.id, data.id), eq(categories.userId, user.id)))
      .returning()
      .get();
    if (!updated) throw new Error("Category not found");
    return updated;
  });

export const deleteCategoryFn = createServerFn({ method: "POST" })
  .inputValidator(validateId)
  .handler(async ({ data }) => {
    const user = await requireUser();
    await db
      .delete(categories)
      .where(and(eq(categories.id, data.id), eq(categories.userId, user.id)));
    return { ok: true };
  });
