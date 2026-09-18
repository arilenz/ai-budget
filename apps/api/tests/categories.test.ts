import { describe, expect, it } from "vitest";
import { api } from "./helpers/api.ts";
import { createUser } from "./helpers/users.ts";

type Category = {
  readonly id: number;
  readonly userId: number;
  readonly name: string;
};

describe("categories", () => {
  it("creates a category for the caller", async () => {
    const user = await createUser();

    const response = await user.api.post<Category>("/categories", {
      name: "Groceries",
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ name: "Groceries", userId: user.id });
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

    expect(response.status).toBe(200);
    const remaining = await user.api.get<readonly Category[]>("/categories");
    expect(remaining.body).toEqual([]);
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
