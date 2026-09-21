import { describe, expect, it } from "vitest";
import { api } from "./helpers/api.ts";
import { createUser } from "./helpers/users.ts";

type Category = {
  readonly id: number;
  readonly userId: number;
  readonly name: string;
};

type ErrorBody = {
  readonly error: { readonly code: string; readonly message: string };
};

describe("categories", () => {
  it("creates a category for the caller", async () => {
    const user = await createUser();

    const response = await user.api.post<Category>("/categories", {
      name: "Groceries",
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ name: "Groceries", userId: user.id });
    expect(response.headers.get("location")).toBe(
      `/categories/${response.body.id}`,
    );
  });

  it("lists only the caller's categories", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    await owner.api.post("/categories", { name: "Rent" });
    await stranger.api.post("/categories", { name: "Travel" });

    const response = await owner.api.get<readonly Category[]>("/categories");

    expect(response.status).toBe(200);
    expect(response.body.map((category) => category.name)).toEqual(["Rent"]);
  });

  it("renames a category", async () => {
    const user = await createUser();
    const created = await user.api.post<Category>("/categories", {
      name: "Transport",
    });

    const response = await user.api.patch<Category>(
      `/categories/${created.body.id}`,
      { name: "Commuting" },
    );

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Commuting");
  });

  it("deletes a category", async () => {
    const user = await createUser();
    const created = await user.api.post<Category>("/categories", {
      name: "Subscriptions",
    });

    const response = await user.api.delete(`/categories/${created.body.id}`);

    expect(response.status).toBe(204);
    expect(response.body).toBeUndefined();
    const remaining = await user.api.get<readonly Category[]>("/categories");
    expect(remaining.body).toEqual([]);
  });

  it("answers deleting a missing category with not_found", async () => {
    const user = await createUser();

    const response = await user.api.delete<ErrorBody>("/categories/999999");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("not_found");
  });

  it("does not let one user delete another user's category", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const created = await owner.api.post<Category>("/categories", {
      name: "Health",
    });

    const response = await stranger.api.delete(
      `/categories/${created.body.id}`,
    );

    expect(response.status).toBe(404);
    const remaining = await owner.api.get<readonly Category[]>("/categories");
    expect(remaining.body.map((category) => category.id)).toEqual([
      created.body.id,
    ]);
  });

  it("refuses to delete a category that still has transactions", async () => {
    const user = await createUser();
    const account = await user.api.post<{ id: number }>("/accounts", {
      name: "Wallet",
    });
    const category = await user.api.post<Category>("/categories", {
      name: "Coffee",
    });
    await user.api.post("/transactions", {
      accountId: account.body.id,
      categoryId: category.body.id,
      description: "Latte",
      amount: -4,
    });

    const response = await user.api.delete<ErrorBody>(
      `/categories/${category.body.id}`,
    );

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("category_has_transactions");
  });

  it("rejects requests without a token", async () => {
    const response = await api.get("/categories");

    expect(response.status).toBe(401);
  });

  it("does not let one user rename another user's category", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const created = await owner.api.post<Category>("/categories", {
      name: "Utilities",
    });

    const response = await stranger.api.patch(
      `/categories/${created.body.id}`,
      { name: "Stolen" },
    );

    expect(response.status).toBe(404);
  });
});
