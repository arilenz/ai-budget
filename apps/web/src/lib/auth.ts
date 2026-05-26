import { deleteCookie, setCookie } from "@tanstack/react-start/server";
import {
  AUTH_COOKIE,
  createServerApiClient,
  getTokenFromCookie,
} from "#/lib/api-server";

const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export type CurrentUser = { id: number; email: string };

export function setAuthCookie(token: string) {
  setCookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TOKEN_TTL_SECONDS,
  });
}

export function clearAuthCookie() {
  deleteCookie(AUTH_COOKIE, { path: "/" });
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!getTokenFromCookie()) return null;
  const api = createServerApiClient();
  const { data, error } = await api.GET("/auth/me");
  if (error || !data) {
    clearAuthCookie();
    return null;
  }
  return data;
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}
