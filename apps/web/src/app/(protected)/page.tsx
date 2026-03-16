import { redirect } from "next/navigation";

import { getOnboardingState } from "~/lib/github/server";

import { RepoLanding } from "./_components/repo-landing";

export default async function App() {
  const state = await getOnboardingState();

  if (state.step !== "has_installations") {
    redirect("/setup");
  }

  return <RepoLanding />;
}
