import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { auth } from "#/routes/auth.ts";
import { accounts } from "#/routes/accounts.ts";
import { categories } from "#/routes/categories.ts";
import { transactions } from "#/routes/transactions.ts";
import { reports } from "#/routes/reports.ts";
import { sync } from "#/routes/sync.ts";

export const openApiDoc = {
  openapi: "3.0.0" as const,
  info: { title: "Finance API", version: "0.1.0" },
};

export function createApp() {
  const app = new OpenAPIHono();

  app.use(
    "*",
    cors({
      origin: (process.env.WEB_ORIGIN ?? "http://localhost:3000").split(","),
      credentials: true,
    }),
  );

  app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  });

  app.get("/health", (c) => c.json({ ok: true }));

  app.route("/auth", auth);
  app.route("/accounts", accounts);
  app.route("/categories", categories);
  app.route("/transactions", transactions);
  app.route("/reports", reports);
  app.route("/sync", sync);

  app.doc("/openapi.json", openApiDoc);
  app.get("/docs", swaggerUI({ url: "/openapi.json" }));

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status);
    }
    console.error(err);
    return c.json({ error: "Internal server error" }, 500);
  });

  return app;
}
