import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { db } from "#/db";
import { sessions, users, type User } from "#/db/schema";

export const SESSION_COOKIE = "session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isPasswordValid(password: string) {
  return typeof password === "string" && password.length >= 8;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: number) {
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id, userId, expiresAt });
  setCookie(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return id;
}

export async function destroyCurrentSession() {
  const id = getCookie(SESSION_COOKIE);
  if (id) {
    await db.delete(sessions).where(eq(sessions.id, id));
  }
  deleteCookie(SESSION_COOKIE, { path: "/" });
}

export async function getCurrentUser(): Promise<User | null> {
  const id = getCookie(SESSION_COOKIE);
  if (!id) return null;
  const row = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id))
    .get();
  if (!row) return null;
  if (row.session.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, id));
    deleteCookie(SESSION_COOKIE, { path: "/" });
    return null;
  }
  return row.user;
}
