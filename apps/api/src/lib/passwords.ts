import bcrypt from "bcryptjs";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isPasswordValid(password: string): boolean {
  return typeof password === "string" && password.length >= 8;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
