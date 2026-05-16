import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { AppSidebar } from "#/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "#/components/ui/sidebar";
import { currentUserFn } from "#/lib/auth.functions";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const user = await currentUserFn();
    if (!user) throw redirect({ to: "/login" });
    return { user };
  },
  loader: ({ context }) => ({ user: context.user }),
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useLoaderData();
  return (
    <SidebarProvider>
      <AppSidebar userEmail={user.email} />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
