import { redirect } from "next/navigation";

import { getInstallationRepos, getOnboardingState } from "~/lib/github/server";

import { RepoProvider } from "./_components/repo-context";
import { RepoLanding } from "./_components/repo-landing";

export default async function App() {
  const state = await getOnboardingState();

  if (state.step !== "has_installations") {
    redirect("/setup");
  }

  const firstInstallation = state.installations[0]!;
  const repos = await getInstallationRepos(firstInstallation.id);

  return (
    <RepoProvider installations={state.installations} repos={repos}>
      <RepoLanding />
    </RepoProvider>
  );
}
