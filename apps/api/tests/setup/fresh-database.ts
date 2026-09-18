import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterAll } from "vitest";
import { schemaSqlPath } from "./paths.ts";

// Runs before the test file (and therefore before src/db/index.ts) is
// imported, so every file talks to its own throwaway database.
const directory = mkdtempSync(join(tmpdir(), "finance-api-test-"));
const databasePath = join(directory, "test.db");

const database = new Database(databasePath);
database.exec(readFileSync(schemaSqlPath, "utf8"));
database.close();

process.env.DATABASE_URL = databasePath;
process.env.JWT_SECRET = "test-jwt-secret";
process.env.WEB_ORIGIN = "http://localhost:3000";

afterAll(() => rmSync(directory, { recursive: true, force: true }));
