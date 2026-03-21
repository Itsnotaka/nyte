import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getUserSession } from "~/lib/auth/server";
import { getSyncedRepoSummary } from "~/lib/github/catalog";

import { AppShell } from "./app-shell";

async function ProtectedShell({ children }: { children: React.ReactNode }) {
  const summary = getSyncedRepoSummary();
  const session = await getUserSession();
  if (!session) {
    redirect("/login");
  }

  return <AppShell totalSynced={(await summary).totalSynced}>{children}</AppShell>;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AppShell totalSynced={null}>{null}</AppShell>}>
      <ProtectedShell>{children}</ProtectedShell>
    </Suspense>
  );
}
