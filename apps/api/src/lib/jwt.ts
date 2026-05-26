import { SignJWT, jwtVerify } from "jose";

const ALG = "HS256";
const TTL_SECONDS = 30 * 24 * 60 * 60;

export type JwtPayload = { sub: string };

let cachedSecret: Uint8Array | null = null;
function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET env var is not set");
  cachedSecret = new TextEncoder().encode(secret);
  return cachedSecret;
}

export async function issueToken(userId: number): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALG })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + TTL_SECONDS)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] });
  if (typeof payload.sub !== "string") throw new Error("Invalid token");
  return { sub: payload.sub };
}
