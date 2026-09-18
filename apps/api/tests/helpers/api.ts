import { createApp } from "#/app.ts";

export type ApiResponse<T> = {
  readonly status: number;
  readonly headers: Headers;
  readonly body: T;
};

export type RequestOptions = {
  readonly token?: string;
};

type SendOptions = RequestOptions & { readonly body?: unknown };

const app = createApp();

const buildHeaders = (options: SendOptions): Record<string, string> => ({
  ...(options.body === undefined ? {} : { "content-type": "application/json" }),
  ...(options.token === undefined
    ? {}
    : { authorization: `Bearer ${options.token}` }),
});

const readBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (text === "") return undefined;
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("application/json") ? JSON.parse(text) : text;
};

const send = async <T>(
  method: string,
  path: string,
  options: SendOptions = {},
): Promise<ApiResponse<T>> => {
  const response = await app.request(path, {
    method,
    headers: buildHeaders(options),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return {
    status: response.status,
    headers: response.headers,
    body: (await readBody(response)) as T,
  };
};

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    send<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    send<T>("POST", path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    send<T>("PATCH", path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    send<T>("DELETE", path, options),
};

export type AuthenticatedApi = {
  get: <T>(path: string) => Promise<ApiResponse<T>>;
  post: <T>(path: string, body?: unknown) => Promise<ApiResponse<T>>;
  patch: <T>(path: string, body?: unknown) => Promise<ApiResponse<T>>;
  delete: <T>(path: string) => Promise<ApiResponse<T>>;
};

export const asUser = (token: string): AuthenticatedApi => ({
  get: (path) => api.get(path, { token }),
  post: (path, body) => api.post(path, body, { token }),
  patch: (path, body) => api.patch(path, body, { token }),
  delete: (path) => api.delete(path, { token }),
});
