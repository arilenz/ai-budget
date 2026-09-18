import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "#/app.ts";
import { api } from "./helpers/api.ts";
import { createUser } from "./helpers/users.ts";

type ErrorBody = {
  readonly error: { readonly code: string; readonly message: string };
};

type Category = { readonly id: number };

// The shared helper always sends well-formed JSON, so the cases below that need
// a broken request (or a handler that blows up) drive their own app instance.
const rawApp = createApp();
rawApp.get("/test-only/boom", () => {
  throw new Error("kaboom: an internal detail that must not leak");
});

const readError = async (response: Response): Promise<ErrorBody> =>
  (await response.json()) as ErrorBody;

afterEach(() => vi.restoreAllMocks());

describe("error responses", () => {
  it("uses the code and message envelope for a missing resource", async () => {
    const user = await createUser();

    const response = await user.api.patch<ErrorBody>("/categories/999999", {
      name: "Nowhere",
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: "not_found", message: "Category not found" },
    });
  });

  it("answers an unknown route with not_found", async () => {
    const response = await api.get<ErrorBody>("/no-such-route");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("not_found");
  });
});

describe("authentication errors", () => {
  it("rejects a request without a token as unauthenticated", async () => {
    const response = await api.get<ErrorBody>("/categories");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("unauthenticated");
  });

  it("rejects a token it cannot verify as unauthenticated", async () => {
    const response = await api.get<ErrorBody>("/categories", {
      token: "not-a-real-token",
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("unauthenticated");
  });

  it("reports wrong credentials as invalid_credentials", async () => {
    const user = await createUser();

    const response = await api.post<ErrorBody>("/auth/login", {
      email: user.email,
      password: "a-different-password",
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("invalid_credentials");
  });

  it("reports a taken email as email_taken", async () => {
    const user = await createUser();

    const response = await api.post<ErrorBody>("/auth/signup", {
      email: user.email,
      password: user.password,
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("email_taken");
  });
});

describe("validation errors", () => {
  it("reports an invalid body as validation_failed and names the field", async () => {
    const response = await api.post<ErrorBody>("/auth/signup", {
      email: "not-an-email",
      password: "short",
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("validation_failed");
    expect(response.body.error.message).toContain("email");
  });

  it("reports an invalid path parameter as validation_failed", async () => {
    const user = await createUser();

    const response = await user.api.delete<ErrorBody>("/categories/abc");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("validation_failed");
  });

  it("reports an invalid query parameter as validation_failed", async () => {
    const user = await createUser();

    const response = await user.api.get<ErrorBody>(
      "/reports/monthly-breakdown?month=nope",
    );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("validation_failed");
  });

  it("reports a malformed JSON body as validation_failed", async () => {
    const response = await rawApp.request("/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ not json",
    });

    expect(response.status).toBe(400);
    expect((await readError(response)).error.code).toBe("validation_failed");
  });

  it("keeps a valid request working", async () => {
    const user = await createUser();

    const response = await user.api.post<Category>("/categories", {
      name: "Groceries",
    });

    expect(response.status).toBe(200);
  });
});

describe("unexpected errors", () => {
  it("turns a thrown error into internal_error without leaking its message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await rawApp.request("/test-only/boom");

    expect(response.status).toBe(500);
    expect(await readError(response)).toEqual({
      error: { code: "internal_error", message: "Internal server error" },
    });
  });

  it("logs the original error so it is not lost", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    await rawApp.request("/test-only/boom");

    expect(logged).toHaveBeenCalledWith(expect.any(Error));
  });
});
