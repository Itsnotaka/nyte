import { redirect } from "next/navigation";

import { getOnboardingState } from "~/lib/github-server";

import { ConnectView } from "./_components/connect-view";

export default async function SetupPage() {
  const state = await getOnboardingState();

  switch (state.step) {
    case "no_session":
      redirect("/login");
    case "no_github_token":
      redirect("/login");
    case "no_installation":
      return <ConnectView appInstallUrl={state.appInstallUrl} />;
    case "has_installations":
      redirect("/setup/repos");
  }
}
