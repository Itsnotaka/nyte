import { redirect } from "next/navigation";

import { getSession } from "~/lib/auth/server";
import { HydrateClient, prefetch, trpc } from "~/lib/trpc/server";

import { AppShell } from "./app-shell";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  prefetch(trpc.github.getSyncedRepoSummary.queryOptions());

  return (
    <HydrateClient>
      <AppShell>{children}</AppShell>
    </HydrateClient>
  );
}
