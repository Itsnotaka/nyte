import { redirect } from "next/navigation";

import { getSession } from "~/lib/auth/server";
import { getRepoCatalog, getSyncedRepoCatalog } from "~/lib/github/server";

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

  const catalog = await getRepoCatalog();
  const syncedCatalog = await getSyncedRepoCatalog();

  return (
    <RepoProvider
      installations={catalog.installations}
      repos={catalog.repos}
      syncedRepos={syncedCatalog.syncedRepos}
      totalAccessible={syncedCatalog.totalAccessible}
      totalSynced={syncedCatalog.totalSynced}
    >
      <AppShell>{children}</AppShell>
    </RepoProvider>
  );
}
