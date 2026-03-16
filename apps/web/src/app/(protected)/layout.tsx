import { redirect } from "next/navigation";

import { getSession } from "~/lib/auth/server";
import { getOnboardingState, getInstallationRepos } from "~/lib/github/server";

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

  const state = await getOnboardingState();

  if (state.step !== "has_installations") {
    return <AppShell>{children}</AppShell>;
  }

  const firstInstallation = state.installations[0]!;
  const repos = await getInstallationRepos(firstInstallation.id);

  return (
    <RepoProvider installations={state.installations} repos={repos}>
      <AppShell>{children}</AppShell>
    </RepoProvider>
  );
}
