import { Skeleton } from "@sachikit/ui/components/skeleton";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getOnboardingState } from "~/lib/github/server";
import { caller, HydrateClient, prefetch, trpc } from "~/lib/trpc/server";

import { InboxView } from "./_components/inbox-view";

async function InboxContent() {
  const state = await getOnboardingState();
  if (state.step !== "has_installations") {
    redirect("/setup");
  }

  const data = await caller.github.getInbox();
  if (!data) {
    redirect("/setup");
  }

  prefetch(trpc.github.getInbox.queryOptions());
  prefetch(trpc.settings.getInboxSectionOrder.queryOptions());

  return (
    <HydrateClient>
      <InboxView />
    </HydrateClient>
  );
}

function InboxSkeleton() {
  return (
    <div className="h-full min-h-0 overflow-hidden bg-sachi-base">
      <div className="mx-auto w-full max-w-[960px]">
        {Array.from({ length: 3 }, (_, sectionIndex) => (
          <div key={`s-${sectionIndex}`}>
            <div className="flex items-center gap-2 border-b border-sachi-line-subtle px-4 py-2.5">
              <Skeleton className="size-4" />
              <Skeleton className="h-4 w-5" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div>
              {Array.from({ length: 3 }, (_, rowIndex) => (
                <div
                  key={`r-${sectionIndex}-${rowIndex}`}
                  className="flex items-center gap-3 border-b border-sachi-line-subtle px-4 py-2.5"
                >
                  <Skeleton className="size-7 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/5" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                  <Skeleton className="h-3 w-10 shrink-0" />
                  <Skeleton className="h-3 w-16 shrink-0" />
                  <Skeleton className="h-3 w-12 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<InboxSkeleton />}>
      <InboxContent />
    </Suspense>
  );
}
