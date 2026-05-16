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
  createCategoryFn,
  deleteCategoryFn,
  listCategoriesFn,
  updateCategoryFn,
} from "#/lib/categories.functions";
import type { Category } from "#/db/schema";

export const Route = createFileRoute("/_app/categories")({
  loader: () => listCategoriesFn(),
  component: CategoriesPage,
});

function CategoriesPage() {
  const categories = Route.useLoaderData();
  const router = useRouter();
  const remove = useServerFn(deleteCategoryFn);
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setOpen(true);
  }

  async function onDelete(id: number) {
    if (!confirm("Delete this category?")) return;
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
          <h1 className="text-2xl font-semibold">Categories</h1>
          <p className="text-sm text-muted-foreground">
            Organize transactions by category.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus />
          New category
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
            {categories.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-8 text-center text-muted-foreground"
                >
                  No categories yet.
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell>{category.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(category.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(category)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(category.id)}
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

      <CategoryFormDialog
        open={open}
        onOpenChange={setOpen}
        category={editing}
      />
    </div>
  );
}

type CategoryFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
};

function CategoryFormDialog(props: CategoryFormDialogProps) {
  const router = useRouter();
  const create = useServerFn(createCategoryFn);
  const update = useServerFn(updateCategoryFn);
  const [name, setName] = useState(props.category?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isEdit = props.category !== null;

  function handleOpenChange(next: boolean) {
    if (!next) {
      setError(null);
      setPending(false);
    }
    if (next) {
      setName(props.category?.name ?? "");
      setError(null);
    }
    props.onOpenChange(next);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (props.category) {
        await update({ data: { id: props.category.id, name } });
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
          <DialogTitle>
            {isEdit ? "Edit category" : "New category"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the category name."
              : "Add a new category to label transactions."}
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
