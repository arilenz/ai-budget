import { describe, expect, it } from "vitest";
import { api } from "./helpers/api.ts";
import { createUser } from "./helpers/users.ts";

type Account = {
  readonly id: number;
  readonly userId: number;
  readonly name: string;
  readonly type: string;
};

type ErrorBody = {
  readonly error: { readonly code: string; readonly message: string };
};

describe("accounts", () => {
  it("creates a cash account for the caller", async () => {
    const user = await createUser();

    const response = await user.api.post<Account>("/accounts", {
      name: "Wallet",
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: "Wallet",
      type: "cash",
      userId: user.id,
    });
    expect(response.headers.get("location")).toBe(
      `/accounts/${response.body.id}`,
    );
  });

  it("gets an account by the URL from Location", async () => {
    const user = await createUser();
    const created = await user.api.post<Account>("/accounts", {
      name: "Savings",
    });

    const response = await user.api.get<Account>(
      created.headers.get("location") ?? "",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual(created.body);
  });

  it("answers getting a missing account with not_found", async () => {
    const user = await createUser();

    const response = await user.api.get<ErrorBody>("/accounts/999999");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("not_found");
  });

  it("does not let one user get another user's account", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const created = await owner.api.post<Account>("/accounts", {
      name: "Private",
    });

    const response = await stranger.api.get(`/accounts/${created.body.id}`);

    expect(response.status).toBe(404);
  });

  it("lists only the caller's accounts", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    await owner.api.post("/accounts", { name: "Card" });
    await stranger.api.post("/accounts", { name: "Other card" });

    const response = await owner.api.get<readonly Account[]>("/accounts");

    expect(response.status).toBe(200);
    expect(response.body.map((account) => account.name)).toEqual(["Card"]);
  });

  it("renames an account", async () => {
    const user = await createUser();
    const created = await user.api.post<Account>("/accounts", {
      name: "Wallet",
    });

    const response = await user.api.patch<Account>(
      `/accounts/${created.body.id}`,
      { name: "Pocket" },
    );

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Pocket");
  });

  it("deletes an account", async () => {
    const user = await createUser();
    const created = await user.api.post<Account>("/accounts", {
      name: "Old wallet",
    });

    const response = await user.api.delete(`/accounts/${created.body.id}`);

    expect(response.status).toBe(204);
    expect(response.body).toBeUndefined();
    const lookup = await user.api.get(`/accounts/${created.body.id}`);
    expect(lookup.status).toBe(404);
  });

  it("answers deleting a missing account with not_found", async () => {
    const user = await createUser();

    const response = await user.api.delete<ErrorBody>("/accounts/999999");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("not_found");
  });

  it("does not let one user delete another user's account", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const created = await owner.api.post<Account>("/accounts", {
      name: "Mine",
    });

    const response = await stranger.api.delete(`/accounts/${created.body.id}`);

    expect(response.status).toBe(404);
    const lookup = await owner.api.get(`/accounts/${created.body.id}`);
    expect(lookup.status).toBe(200);
  });

  it("refuses to delete an account that still has transactions", async () => {
    const user = await createUser();
    const account = await user.api.post<Account>("/accounts", {
      name: "Busy",
    });
    const category = await user.api.post<{ id: number }>("/categories", {
      name: "Food",
    });
    await user.api.post("/transactions", {
      accountId: account.body.id,
      categoryId: category.body.id,
      description: "Lunch",
      amount: -12,
    });

    const response = await user.api.delete<ErrorBody>(
      `/accounts/${account.body.id}`,
    );

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("account_has_transactions");
  });

  it("rejects requests without a token", async () => {
    const response = await api.get("/accounts");

    expect(response.status).toBe(401);
  });
});
