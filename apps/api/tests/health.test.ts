import { describe, expect, it } from "vitest";
import { api } from "./helpers/api.ts";

describe("GET /health", () => {
  it("reports that the API is up", async () => {
    const response = await api.get<{ ok: boolean }>("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
