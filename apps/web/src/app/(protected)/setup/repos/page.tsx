import { redirect } from "next/navigation";

import { getOnboardingState, getInstallationRepos } from "~/lib/github/server";

import { RepoPickerView } from "../_components/repo-picker-view";

export default async function ReposPage() {
  const state = await getOnboardingState();

  if (state.step !== "has_installations") {
    redirect("/setup");
  }

  const firstInstallation = state.installations[0]!;
  const repos = await getInstallationRepos(firstInstallation.id);

  return <RepoPickerView installation={firstInstallation} repos={repos} />;
}
