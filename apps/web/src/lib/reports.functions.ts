import { createServerFn } from "@tanstack/react-start";
import { createServerApiClient, unwrap } from "#/lib/api-server";

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

type BreakdownInput = { month: string };

export type CategoryBreakdownRow = {
  categoryId: number;
  categoryName: string;
  total: number;
  txCount: number;
};

function parseMonthInput(data: unknown): BreakdownInput {
  if (!data || typeof data !== "object") throw new Error("month is required");
  const month = (data as { month: unknown }).month;
  if (typeof month !== "string" || !MONTH_PATTERN.test(month)) {
    throw new Error("month must be in YYYY-MM format");
  }
  return { month };
}

export const monthlyCategoryBreakdownFn = createServerFn({ method: "GET" })
  .inputValidator(parseMonthInput)
  .handler(async ({ data }): Promise<Array<CategoryBreakdownRow>> =>
    unwrap(
      await createServerApiClient().GET("/reports/monthly-breakdown", {
        params: { query: { month: data.month } },
      }),
      "Failed to load monthly breakdown",
    ),
  );
