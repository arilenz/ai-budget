import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { drizzleKitBin, schemaSqlPath } from "./paths.ts";

// The project has no migration files, so the test schema is dumped straight
// from schema.ts once per run and replayed into every test file's database.
export default function dumpSchemaSql(): void {
  const sql = execFileSync(drizzleKitBin, ["export", "--sql"], {
    encoding: "utf8",
  });
  mkdirSync(dirname(schemaSqlPath), { recursive: true });
  writeFileSync(schemaSqlPath, sql);
}
