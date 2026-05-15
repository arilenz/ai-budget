import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { users } from "#/db/schema";
import {
  createSession,
  destroyCurrentSession,
  getCurrentUser,
  hashPassword,
  isPasswordValid,
  normalizeEmail,
  verifyPassword,
} from "#/lib/auth";

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

export const signUpFn = createServerFn({ method: "POST" })
  .inputValidator(validateCredentials)
  .handler(async ({ data }) => {
    const email = normalizeEmail(data.email);
    if (!email) throw new Error("Email is required");
    if (!isPasswordValid(data.password))
      throw new Error("Password must be at least 8 characters");

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get();
    if (existing) throw new Error("Email is already registered");

    const passwordHash = await hashPassword(data.password);
    const inserted = await db
      .insert(users)
      .values({ email, passwordHash })
      .returning()
      .get();
    await createSession(inserted.id);
    return { ok: true };
  });

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator(validateCredentials)
  .handler(async ({ data }) => {
    const email = normalizeEmail(data.email);
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get();
    if (!user) throw new Error("Invalid email or password");
    const ok = await verifyPassword(data.password, user.passwordHash);
    if (!ok) throw new Error("Invalid email or password");
    await createSession(user.id);
    return { ok: true };
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  await destroyCurrentSession();
  return { ok: true };
});

export const currentUserFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const user = await getCurrentUser();
    if (!user) return null;
    return { id: user.id, email: user.email };
  },
);
