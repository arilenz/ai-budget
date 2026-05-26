import { serve } from "@hono/node-server";
import { createApp } from "#/app.ts";

const app = createApp();
const port = Number(process.env.PORT ?? 3001);

serve({ fetch: app.fetch, port }, ({ port: actual }) => {
  console.log(`API listening on http://localhost:${actual}`);
  console.log(`  - docs: http://localhost:${actual}/docs`);
  console.log(`  - openapi: http://localhost:${actual}/openapi.json`);
});
