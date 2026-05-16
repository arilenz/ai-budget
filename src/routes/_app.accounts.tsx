import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#/components/ui/dialog";
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
  createAccountFn,
  deleteAccountFn,
  listAccountsFn,
  updateAccountFn,
} from "#/lib/accounts.functions";
import type { Account } from "#/db/schema";

export const Route = createFileRoute("/_app/accounts")({
  loader: () => listAccountsFn(),
  component: AccountsPage,
});

function AccountsPage() {
  const accounts = Route.useLoaderData();
  const router = useRouter();
  const remove = useServerFn(deleteAccountFn);
  const [editing, setEditing] = useState<Account | null>(null);
  const [open, setOpen] = useState(false);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(account: Account) {
    setEditing(account);
    setOpen(true);
  }

  async function onDelete(id: number) {
    if (!confirm("Delete this account?")) return;
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
          <h1 className="text-2xl font-semibold">Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Manage the accounts you use for transactions.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus />
          New account
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-8 text-center text-muted-foreground"
                >
                  No accounts yet.
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>{account.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(account.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(account)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(account.id)}
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

      <AccountFormDialog
        open={open}
        onOpenChange={setOpen}
        account={editing}
      />
    </div>
  );
}

type AccountFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
};

function AccountFormDialog(props: AccountFormDialogProps) {
  const router = useRouter();
  const create = useServerFn(createAccountFn);
  const update = useServerFn(updateAccountFn);
  const [name, setName] = useState(props.account?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isEdit = props.account !== null;

  function handleOpenChange(next: boolean) {
    if (!next) {
      setError(null);
      setPending(false);
    }
    if (next) {
      setName(props.account?.name ?? "");
      setError(null);
    }
    props.onOpenChange(next);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (props.account) {
        await update({ data: { id: props.account.id, name } });
      } else {
        await create({ data: { name } });
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
          <DialogTitle>{isEdit ? "Edit account" : "New account"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the account name."
              : "Add a new account to record transactions against."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
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
