import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getOnboardingState } from "~/lib/github/server";
import { caller, HydrateClient, prefetch, trpc } from "~/lib/trpc/server";

import { InboxSkeleton } from "./_components/inbox-skeleton";
import { InboxView } from "./_components/inbox-view";

async function InboxContent() {
  const state = await getOnboardingState();
  if (state.step !== "has_installations") {
    redirect("/setup");
  }

  const metaPromise = caller.github.getInboxSectionMeta();

  await Promise.all([
    prefetch(trpc.github.getInboxSectionMeta.queryOptions()),
    prefetch(trpc.github.getInbox.queryOptions()),
    prefetch(trpc.settings.getInboxSectionOrder.queryOptions()),
  ]);

  const meta = await metaPromise;
  if (!meta) {
    redirect("/setup");
  }

  return (
    <HydrateClient>
      <InboxView initialMeta={meta} />
    </HydrateClient>
  );
}

export default function App() {
  return (
    <Suspense fallback={<InboxSkeleton />}>
      <InboxContent />
    </Suspense>
  );
}
