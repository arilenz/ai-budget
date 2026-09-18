import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { drizzleKitBin, schemaSqlPath } from "./paths.ts";

// There are no migrations yet (API-02), so the test schema is dumped straight
// from schema.ts once per run and replayed into every test file's database.
// Once migrations land, replace this with the drizzle migrator.
export default function dumpSchemaSql(): void {
  const sql = execFileSync(drizzleKitBin, ["export", "--sql"], {
    encoding: "utf8",
  });
  mkdirSync(dirname(schemaSqlPath), { recursive: true });
  writeFileSync(schemaSqlPath, sql);
}
