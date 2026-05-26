import createFetchClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./schema.ts";

export type TokenProvider = () =>
  | string
  | null
  | undefined
  | Promise<string | null | undefined>;

export type ApiClientConfig = {
  baseUrl: string;
  getToken?: TokenProvider;
  fetch?: typeof fetch;
};

export function createApiClient(config: ApiClientConfig) {
  const client = createFetchClient<paths>({
    baseUrl: config.baseUrl,
    fetch: config.fetch,
  });
  if (config.getToken) {
    const getToken = config.getToken;
    const authMiddleware: Middleware = {
      async onRequest({ request }) {
        const token = await getToken();
        if (token) request.headers.set("Authorization", `Bearer ${token}`);
        return request;
      },
    };
    client.use(authMiddleware);
  }
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;
export type { paths } from "./schema.ts";
