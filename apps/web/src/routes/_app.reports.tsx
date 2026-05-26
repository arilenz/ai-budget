import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import {
  monthlyCategoryBreakdownFn,
  type CategoryBreakdownRow,
} from "#/lib/reports.functions";

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

type ReportsSearch = { month?: string };
type SortDirection = "asc" | "desc";

function validateReportsSearch(input: Record<string, unknown>): ReportsSearch {
  if (typeof input.month === "string" && MONTH_PATTERN.test(input.month)) {
    return { month: input.month };
  }
  return {};
}

function currentMonthString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthDateRange(month: string): { from: string; to: string } {
  const [year, monthNum] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

const amountFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const Route = createFileRoute("/_app/reports")({
  validateSearch: validateReportsSearch,
  loaderDeps: ({ search }) => ({ month: search.month ?? currentMonthString() }),
  loader: async ({ deps }) => {
    const rows = await monthlyCategoryBreakdownFn({
      data: { month: deps.month },
    });
    return { rows, month: deps.month };
  },
  component: ReportsPage,
});

function ReportsPage() {
  const { rows, month } = Route.useLoaderData();
  const navigate = Route.useNavigate();
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  const sortedRows = useMemo(() => {
    const copy = rows.slice();
    copy.sort((a, b) =>
      sortDir === "asc" ? a.total - b.total : b.total - a.total,
    );
    return copy;
  }, [rows, sortDir]);

  function setMonth(next: string) {
    if (!MONTH_PATTERN.test(next)) return;
    navigate({ search: { month: next }, replace: true });
  }

  function toggleSort() {
    setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
  }

  const { from, to } = monthDateRange(month);
  const totalAcrossCategories = sortedRows.reduce((s, r) => s + r.total, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Spending breakdown by category for the selected month.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="report-month" className="text-xs text-muted-foreground">
            Month
          </Label>
          <Input
            id="report-month"
            type="month"
            className="w-[180px]"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">
                <button
                  type="button"
                  onClick={toggleSort}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  Amount
                  {sortDir === "asc" ? (
                    <ArrowUp className="size-3.5" />
                  ) : (
                    <ArrowDown className="size-3.5" />
                  )}
                </button>
              </TableHead>
              <TableHead className="w-[120px] text-right text-muted-foreground">
                Transactions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-8 text-center text-muted-foreground"
                >
                  No transactions in this month.
                </TableCell>
              </TableRow>
            ) : (
              sortedRows.map((row) => (
                <BreakdownRow
                  key={row.categoryId}
                  row={row}
                  from={from}
                  to={to}
                />
              ))
            )}
            {sortedRows.length > 0 ? (
              <TableRow className="font-medium">
                <TableCell>Total</TableCell>
                <TableCell
                  className={
                    "text-right tabular-nums " +
                    (totalAcrossCategories < 0 ? "text-destructive" : "")
                  }
                >
                  {amountFormatter.format(totalAcrossCategories)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {sortedRows.reduce((s, r) => s + r.txCount, 0)}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

type BreakdownRowProps = {
  row: CategoryBreakdownRow;
  from: string;
  to: string;
};

function BreakdownRow(props: BreakdownRowProps) {
  return (
    <TableRow>
      <TableCell>
        <Link
          to="/transactions"
          search={{
            from: props.from,
            to: props.to,
            category: props.row.categoryId,
          }}
          className="underline-offset-4 hover:underline"
        >
          {props.row.categoryName}
        </Link>
      </TableCell>
      <TableCell
        className={
          "text-right tabular-nums " +
          (props.row.total < 0 ? "text-destructive" : "")
        }
      >
        {amountFormatter.format(props.row.total)}
      </TableCell>
      <TableCell className="text-right text-muted-foreground">
        {props.row.txCount}
      </TableCell>
    </TableRow>
  );
}
