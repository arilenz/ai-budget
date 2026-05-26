import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { stringify } from "yaml";
import { createApp, openApiDoc } from "#/app.ts";

const outPath = resolve(process.cwd(), process.argv[2] ?? "../../openapi.yaml");
const app = createApp();
const spec = app.getOpenAPIDocument(openApiDoc);
writeFileSync(outPath, stringify(spec));
console.log(`wrote ${outPath}`);
