import { redirect } from "next/navigation";

import { getInstallationRepos, getOnboardingState } from "~/lib/github/server";
import { getSession } from "~/lib/auth/server";

import { AppShell } from "./app-shell";
import { RepoProvider } from "./_components/repo-context";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const state = await getOnboardingState();
  const installations = state.step === "has_installations" ? state.installations : [];
  const repos = (
    await Promise.all(
      installations.map((installation) => getInstallationRepos(installation.id)),
    )
  ).flat();

  return (
    <RepoProvider installations={installations} repos={repos}>
      <AppShell>{children}</AppShell>
    </RepoProvider>
  );
}
