import { createFileRoute, redirect } from "@tanstack/react-router";
import { currentUserFn } from "#/lib/auth.functions";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const user = await currentUserFn();
    throw redirect({ to: user ? "/transactions" : "/login" });
  },
});
