import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { createRouter } from "#/lib/router.ts";
import { handleError, handleNotFound } from "#/middleware/errors.ts";
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
  const app = createRouter();

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

  app.onError(handleError);
  app.notFound(handleNotFound);

  return app;
}
