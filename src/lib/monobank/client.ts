import type {
  ClientInfo,
  CurrencyRate,
  StatementItem,
} from "#/lib/monobank/types";

const BASE_URL = "https://api.monobank.ua";

const STATEMENT_MAX_RANGE_SECONDS = 31 * 24 * 60 * 60 + 60 * 60;

export class MonobankError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "MonobankError";
    this.status = status;
    this.body = body;
  }
}

function getToken() {
  const token = process.env.MONOBANK_TOKEN;
  if (!token) {
    throw new Error(
      "MONOBANK_TOKEN env var is not set. Get a token at https://api.monobank.ua/",
    );
  }
  return token;
}

async function request<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.auth !== false) {
    headers.set("X-Token", getToken());
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  const text = await response.text();
  const body: unknown = text ? safeJson(text) : null;
  if (!response.ok) {
    const message =
      (body && typeof body === "object" && "errorDescription" in body
        ? String((body as { errorDescription: unknown }).errorDescription)
        : null) ?? `Monobank request failed: ${response.status}`;
    throw new MonobankError(message, response.status, body);
  }
  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function getCurrency() {
  return request<Array<CurrencyRate>>("/bank/currency", { auth: false });
}

export function getClientInfo() {
  return request<ClientInfo>("/personal/client-info");
}

export async function getStatement(
  accountId: string,
  from: Date | number,
  to: Date | number = new Date(),
): Promise<Array<StatementItem>> {
  const fromSec = toUnixSeconds(from);
  const toSec = toUnixSeconds(to);
  if (toSec < fromSec) {
    throw new Error("Statement: `to` must be greater than or equal to `from`");
  }
  if (toSec - fromSec > STATEMENT_MAX_RANGE_SECONDS) {
    throw new Error("Statement: range cannot exceed 31 days + 1 hour");
  }
  return request<Array<StatementItem>>(
    `/personal/statement/${encodeURIComponent(accountId)}/${fromSec}/${toSec}`,
  );
}

export function setWebhook(webHookUrl: string) {
  return request<{ status: "ok" }>("/personal/webhook", {
    method: "POST",
    body: JSON.stringify({ webHookUrl }),
  });
}

function toUnixSeconds(value: Date | number) {
  if (value instanceof Date) return Math.floor(value.getTime() / 1000);
  if (value > 1e12) return Math.floor(value / 1000);
  return Math.floor(value);
}
