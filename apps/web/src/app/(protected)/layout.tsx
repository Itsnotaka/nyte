import { redirect } from "next/navigation";

import { getSession } from "~/lib/auth/server";

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

  return (
    <RepoProvider repos={[]} totalSynced={0}>
      <AppShell>{children}</AppShell>
    </RepoProvider>
  );
}
