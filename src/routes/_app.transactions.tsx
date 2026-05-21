import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { listAccountsFn } from "#/lib/accounts.functions";
import { listCategoriesFn } from "#/lib/categories.functions";
import {
  createTransactionFn,
  deleteTransactionFn,
  listTransactionsFn,
  updateTransactionFn,
} from "#/lib/transactions.functions";
import type { Account, Category } from "#/db/schema";

type TransactionRow = Awaited<ReturnType<typeof listTransactionsFn>>[number];

type TransactionsSearch = {
  from?: string;
  to?: string;
  account?: number;
  category?: number;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseSearchDate(value: unknown): string | undefined {
  return typeof value === "string" && DATE_PATTERN.test(value) ? value : undefined;
}

function parseSearchId(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function validateTransactionsSearch(
  input: Record<string, unknown>,
): TransactionsSearch {
  return {
    from: parseSearchDate(input.from),
    to: parseSearchDate(input.to),
    account: parseSearchId(input.account),
    category: parseSearchId(input.category),
  };
}

export const Route = createFileRoute("/_app/transactions")({
  validateSearch: validateTransactionsSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [transactions, accounts, categories] = await Promise.all([
      listTransactionsFn({
        data: {
          accountId: deps.account,
          categoryId: deps.category,
          from: deps.from,
          to: deps.to,
        },
      }),
      listAccountsFn(),
      listCategoriesFn(),
    ]);
    return { transactions, accounts, categories };
  },
  component: TransactionsPage,
});

const amountFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function TransactionsPage() {
  const { transactions, accounts, categories } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const remove = useServerFn(deleteTransactionFn);
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [open, setOpen] = useState(false);

  const cannotCreate = accounts.length === 0 || categories.length === 0;
  const hasActiveFilter = Boolean(
    search.from || search.to || search.account || search.category,
  );

  function setFilter<K extends keyof TransactionsSearch>(
    key: K,
    value: TransactionsSearch[K] | undefined,
  ) {
    navigate({
      search: (prev) => ({ ...prev, [key]: value }),
      replace: true,
    });
  }

  function clearFilters() {
    navigate({ search: {}, replace: true });
  }

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(t: TransactionRow) {
    setEditing(t);
    setOpen(true);
  }

  async function onDelete(id: number) {
    if (!confirm("Delete this transaction?")) return;
    try {
      await remove({ data: { id } });
      router.invalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            Track money in and out of your accounts.
          </p>
        </div>
        <Button onClick={openCreate} disabled={cannotCreate}>
          <Plus />
          New transaction
        </Button>
      </div>

      {cannotCreate ? (
        <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
          You need at least one{" "}
          <Link to="/accounts" className="underline">
            account
          </Link>{" "}
          and one{" "}
          <Link to="/categories" className="underline">
            category
          </Link>{" "}
          before you can add a transaction.
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-from" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input
            id="filter-from"
            type="date"
            className="w-[160px]"
            value={search.from ?? ""}
            onChange={(e) => setFilter("from", e.target.value || undefined)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-to" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input
            id="filter-to"
            type="date"
            className="w-[160px]"
            value={search.to ?? ""}
            onChange={(e) => setFilter("to", e.target.value || undefined)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-account" className="text-xs text-muted-foreground">
            Account
          </Label>
          <Select
            value={search.account !== undefined ? String(search.account) : "all"}
            onValueChange={(v) =>
              setFilter("account", v === "all" ? undefined : Number(v))
            }
          >
            <SelectTrigger id="filter-account" className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-category" className="text-xs text-muted-foreground">
            Category
          </Label>
          <Select
            value={search.category !== undefined ? String(search.category) : "all"}
            onValueChange={(v) =>
              setFilter("category", v === "all" ? undefined : Number(v))
            }
          >
            <SelectTrigger id="filter-category" className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {hasActiveFilter ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X />
            Clear
          </Button>
        ) : null}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  {hasActiveFilter
                    ? "No transactions match these filters."
                    : "No transactions yet."}
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-muted-foreground">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{t.description}</TableCell>
                  <TableCell>{t.accountName}</TableCell>
                  <TableCell>{t.categoryName}</TableCell>
                  <TableCell
                    className={
                      "text-right tabular-nums " +
                      (t.amount < 0 ? "text-destructive" : "")
                    }
                  >
                    {amountFormatter.format(t.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(t)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(t.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {open ? (
        <TransactionFormDialog
          open={open}
          onOpenChange={setOpen}
          transaction={editing}
          accounts={accounts}
          categories={categories}
        />
      ) : null}
    </div>
  );
}

type TransactionFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionRow | null;
  accounts: Array<Account>;
  categories: Array<Category>;
};

function TransactionFormDialog(props: TransactionFormDialogProps) {
  const router = useRouter();
  const create = useServerFn(createTransactionFn);
  const update = useServerFn(updateTransactionFn);
  const isEdit = props.transaction !== null;

  const [accountId, setAccountId] = useState<string>(
    props.transaction
      ? String(props.transaction.accountId)
      : props.accounts[0]
        ? String(props.accounts[0].id)
        : "",
  );
  const [categoryId, setCategoryId] = useState<string>(
    props.transaction
      ? String(props.transaction.categoryId)
      : props.categories[0]
        ? String(props.categories[0].id)
        : "",
  );
  const [description, setDescription] = useState(
    props.transaction?.description ?? "",
  );
  const [amount, setAmount] = useState(
    props.transaction ? String(props.transaction.amount) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function handleOpenChange(next: boolean) {
    if (next) {
      setAccountId(
        props.transaction
          ? String(props.transaction.accountId)
          : props.accounts[0]
            ? String(props.accounts[0].id)
            : "",
      );
      setCategoryId(
        props.transaction
          ? String(props.transaction.categoryId)
          : props.categories[0]
            ? String(props.categories[0].id)
            : "",
      );
      setDescription(props.transaction?.description ?? "");
      setAmount(props.transaction ? String(props.transaction.amount) : "");
      setError(null);
    } else {
      setError(null);
      setPending(false);
    }
    props.onOpenChange(next);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsedAmount = Number(amount);
    if (!accountId || !categoryId) {
      setError("Account and category are required");
      return;
    }
    if (!Number.isFinite(parsedAmount)) {
      setError("Amount must be a number");
      return;
    }
    setPending(true);
    const payload = {
      accountId: Number(accountId),
      categoryId: Number(categoryId),
      description,
      amount: parsedAmount,
    };
    try {
      if (props.transaction) {
        await update({ data: { id: props.transaction.id, ...payload } });
      } else {
        await create({ data: payload });
      }
      router.invalidate();
      props.onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit transaction" : "New transaction"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the transaction details."
              : "Record a new transaction."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="account">Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger id="account">
                <SelectValue placeholder="Select an account" />
              </SelectTrigger>
              <SelectContent>
                {props.accounts.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {props.categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Use a negative value for expenses.
            </p>
          </div>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
