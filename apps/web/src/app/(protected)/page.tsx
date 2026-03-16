import { redirect } from "next/navigation";

import { getInboxData, getOnboardingState } from "~/lib/github/server";

import { InboxView } from "./_components/inbox-view";

export default async function App() {
  const state = await getOnboardingState();

  if (state.step !== "has_installations") {
    redirect("/setup");
  }

  const data = await getInboxData();

  if (!data) {
    redirect("/setup");
  }

  return <InboxView data={data} />;
}
