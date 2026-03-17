import { redirect } from "next/navigation";

import { getSession } from "~/lib/auth/server";
import { getSyncedRepoCatalog } from "~/lib/github/server";

import { RepoProvider } from "./_components/repo-context";
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

  const syncedCatalog = await getSyncedRepoCatalog();

  return (
    <RepoProvider
      repos={syncedCatalog.repos}
      totalSynced={syncedCatalog.totalSynced}
    >
      <AppShell>{children}</AppShell>
    </RepoProvider>
  );
}
