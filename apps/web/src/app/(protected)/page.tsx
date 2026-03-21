import { HydrateClient, prefetch, trpc } from "~/lib/trpc/server";

import { InboxWorkspace } from "./_components/inbox-workspace";

export default function App() {
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
