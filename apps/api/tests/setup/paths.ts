import { fileURLToPath } from "node:url";

export const drizzleKitBin = fileURLToPath(
  new URL("../../node_modules/.bin/drizzle-kit", import.meta.url),
);

export const schemaSqlPath = fileURLToPath(
  new URL("../.tmp/schema.sql", import.meta.url),
);
