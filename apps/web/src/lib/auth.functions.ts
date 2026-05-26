import { createServerFn } from "@tanstack/react-start";
import { createApiClient } from "#api-client";
import { clearAuthCookie, getCurrentUser, setAuthCookie } from "#/lib/auth";
import { getApiBaseUrl, unwrap } from "#/lib/api-server";

type Credentials = { email: string; password: string };

function validateCredentials(data: unknown): Credentials {
  if (
    !data ||
    typeof data !== "object" ||
    typeof (data as Credentials).email !== "string" ||
    typeof (data as Credentials).password !== "string"
  ) {
    throw new Error("Email and password are required");
  }
  return data as Credentials;
}

function unauthedClient() {
  return createApiClient({ baseUrl: getApiBaseUrl() });
}

export const signUpFn = createServerFn({ method: "POST" })
  .inputValidator(validateCredentials)
  .handler(async ({ data }) => {
    const session = unwrap(
      await unauthedClient().POST("/auth/signup", { body: data }),
      "Signup failed",
    );
    setAuthCookie(session.token);
    return { ok: true as const };
  });

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator(validateCredentials)
  .handler(async ({ data }) => {
    const session = unwrap(
      await unauthedClient().POST("/auth/login", { body: data }),
      "Invalid email or password",
    );
    setAuthCookie(session.token);
    return { ok: true as const };
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  clearAuthCookie();
  return { ok: true as const };
});

export const currentUserFn = createServerFn({ method: "GET" }).handler(
  async () => getCurrentUser(),
);
