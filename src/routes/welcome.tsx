import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { currentUserFn, logoutFn } from "#/lib/auth.functions";

export const Route = createFileRoute("/welcome")({
  beforeLoad: async () => {
    const user = await currentUserFn();
    if (!user) throw redirect({ to: "/login" });
    return { user };
  },
  loader: ({ context }) => ({ user: context.user }),
  component: WelcomePage,
});

function WelcomePage() {
  const router = useRouter();
  const { user } = Route.useLoaderData();
  const logout = useServerFn(logoutFn);

  async function onLogout() {
    await logout();
    await router.invalidate();
    router.navigate({ to: "/login" });
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
          <CardDescription>You are signed in as {user.email}.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={onLogout}>
            Log out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
