import { redirect } from "next/navigation";

import { getOnboardingState } from "~/lib/github/server";
import { HydrateClient, prefetch, trpc } from "~/lib/trpc/server";

import { InboxWorkspace } from "./_components/inbox-workspace";

export default async function App() {
  const state = await getOnboardingState();
  if (state.step !== "has_installations") {
    redirect("/setup");
  }

  prefetch({
    ...trpc.github.getInboxData.queryOptions(),
    gcTime: 5 * 60_000,
    staleTime: 60_000,
  });
  prefetch({
    ...trpc.settings.getInboxSectionOrder.queryOptions(),
    gcTime: 5 * 60_000,
    staleTime: 60_000,
  });

  return (
    <HydrateClient>
      <InboxWorkspace />
    </HydrateClient>
  );
}
