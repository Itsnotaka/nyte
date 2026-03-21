import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getOnboardingState } from "~/lib/github/server";

import { InboxSkeleton } from "./_components/inbox-skeleton";
import { InboxView } from "./_components/inbox-view";

async function InboxContent() {
  const state = await getOnboardingState();
  if (state.step !== "has_installations") {
    redirect("/setup");
  }

  return <InboxView />;
}

export default function App() {
  return (
    <Suspense fallback={<InboxSkeleton />}>
      <InboxContent />
    </Suspense>
  );
}
