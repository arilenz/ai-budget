import { createServerFn } from "@tanstack/react-start";
import { createServerApiClient, unwrap, unwrapEmpty } from "#/lib/api-server";

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
  async () =>
    unwrap(
      await createServerApiClient().GET("/categories"),
      "Failed to list categories",
    ),
);

export const createCategoryFn = createServerFn({ method: "POST" })
  .inputValidator(validateCategoryInput)
  .handler(async ({ data }) =>
    unwrap(
      await createServerApiClient().POST("/categories", { body: data }),
      "Failed to create category",
    ),
  );

export const updateCategoryFn = createServerFn({ method: "POST" })
  .inputValidator(validateCategoryUpdate)
  .handler(async ({ data }) =>
    unwrap(
      await createServerApiClient().PATCH("/categories/{id}", {
        params: { path: { id: data.id } },
        body: { name: data.name },
      }),
      "Failed to update category",
    ),
  );

export const deleteCategoryFn = createServerFn({ method: "POST" })
  .inputValidator(validateId)
  .handler(async ({ data }) =>
    unwrapEmpty(
      await createServerApiClient().DELETE("/categories/{id}", {
        params: { path: { id: data.id } },
      }),
      "Failed to delete category",
    ),
  );
