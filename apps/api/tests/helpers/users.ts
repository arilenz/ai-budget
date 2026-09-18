import { randomUUID } from "node:crypto";
import { api, asUser, type AuthenticatedApi } from "./api.ts";

export type Credentials = {
  readonly email: string;
  readonly password: string;
};

export type TestUser = Credentials & {
  readonly id: number;
  readonly token: string;
  readonly api: AuthenticatedApi;
};

type SessionResponse = {
  readonly token: string;
  readonly user: { readonly id: number; readonly email: string };
};

const uniqueEmail = () => `user-${randomUUID()}@example.test`;

export const createUser = async (
  credentials: Partial<Credentials> = {},
): Promise<TestUser> => {
  const email = credentials.email ?? uniqueEmail();
  const password = credentials.password ?? "test-password";
  const { status, body } = await api.post<SessionResponse>("/auth/signup", {
    email,
    password,
  });
  if (status !== 200) {
    throw new Error(`Could not create a test user: sign-up returned ${status}`);
  }
  return {
    id: body.user.id,
    email,
    password,
    token: body.token,
    api: asUser(body.token),
  };
};

export const logIn = async (credentials: Credentials): Promise<TestUser> => {
  const { status, body } = await api.post<SessionResponse>(
    "/auth/login",
    credentials,
  );
  if (status !== 200) {
    throw new Error(`Could not log in a test user: login returned ${status}`);
  }
  return {
    ...credentials,
    id: body.user.id,
    token: body.token,
    api: asUser(body.token),
  };
};
