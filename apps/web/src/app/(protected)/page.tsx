import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getInboxData, getOnboardingState } from "~/lib/github/server";
import { caller } from "~/lib/trpc/server";

import { InboxSkeleton } from "./_components/inbox-skeleton";
import { InboxView } from "./_components/inbox-view";

async function InboxContent() {
  const data = getInboxData();
  const order = caller.settings.getInboxSectionOrder();
  const state = await getOnboardingState();
  if (state.step !== "has_installations") {
    redirect("/setup");
  }

  const [inbox, sectionOrder] = await Promise.all([data, order]);
  if (!inbox) {
    redirect("/setup");
  }

  return <InboxView data={inbox} sectionOrder={sectionOrder} />;
}
export default function App() {
  return (
    <Suspense fallback={<InboxSkeleton />}>
      <InboxContent />
    </Suspense>
  );
}
