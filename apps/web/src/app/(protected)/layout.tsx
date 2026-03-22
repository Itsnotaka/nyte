import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getUserSession } from "~/lib/auth/server";
import { getSyncedRepoLookupRows } from "~/lib/github/catalog";

import { AppShell } from "./app-shell";

async function ProtectedShell({ children }: { children: React.ReactNode }) {
  const session = await getUserSession();
  if (!session) {
    redirect("/login");
  }

  const rows = await getSyncedRepoLookupRows();
  return <AppShell repos={rows}>{children}</AppShell>;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <ProtectedShell>{children}</ProtectedShell>
    </Suspense>
  );
}
