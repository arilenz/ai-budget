import { getCookie } from "@tanstack/react-start/server";
import { createApiClient, type ApiClient } from "#api-client";

export const AUTH_COOKIE = "auth_token";

export function getApiBaseUrl(): string {
  return process.env.API_URL ?? "http://localhost:3001";
}

export function getTokenFromCookie(): string | null {
  return getCookie(AUTH_COOKIE) ?? null;
}

export function createServerApiClient(): ApiClient {
  return createApiClient({
    baseUrl: getApiBaseUrl(),
    getToken: getTokenFromCookie,
  });
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type FetchResult<T> = {
  data?: T;
  error?: unknown;
  response: Response;
};

export function unwrap<T>(result: FetchResult<T>, fallback = "Request failed"): T {
  if (result.error || result.data === undefined) {
    throw new ApiError(
      extractMessage(result.error, fallback),
      result.response.status,
      result.error,
    );
  }
  return result.data;
}

/** For endpoints that answer `204` with no body, such as deletes. */
export function unwrapEmpty(
  result: FetchResult<unknown>,
  fallback = "Request failed",
): void {
  if (!result.response.ok) {
    throw new ApiError(
      extractMessage(result.error, fallback),
      result.response.status,
      result.error,
    );
  }
}

function extractMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const errField = (body as { error?: unknown }).error;
  if (typeof errField === "string") return errField;
  if (errField && typeof errField === "object") {
    const message = (errField as { message?: unknown }).message;
    if (typeof message === "string") return message;
    const issues = (errField as { issues?: unknown }).issues;
    if (Array.isArray(issues) && issues.length > 0) {
      const first = issues[0] as { message?: unknown; path?: Array<unknown> };
      if (typeof first.message === "string") {
        const path = Array.isArray(first.path) ? first.path.join(".") : "";
        return path ? `${path}: ${first.message}` : first.message;
      }
    }
  }
  return fallback;
}
