import { redirect } from "next/navigation";

import { getOnboardingState, getInstallationRepos } from "~/lib/github/server";

import { RepoLanding } from "./_components/repo-landing";
export default async function App() {
  const state = await getOnboardingState();

  if (state.step !== "has_installations") {
    redirect("/setup");
  }

  const firstInstallation = state.installations[0]!;
  const repos = await getInstallationRepos(firstInstallation.id);

  return <RepoLanding installation={firstInstallation} repos={repos} />;
}
