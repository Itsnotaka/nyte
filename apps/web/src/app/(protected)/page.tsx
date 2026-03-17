import { Spinner } from "@sachikit/ui/components/spinner";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getInboxData, getOnboardingState } from "~/lib/github/server";

import { InboxView } from "./_components/inbox-view";

async function InboxContent() {
  const data = await getInboxData();
  if (!data) {
    redirect("/setup");
  }
  return <InboxView data={data} />;
}

export default async function App() {
  const state = await getOnboardingState();

  if (state.step !== "has_installations") {
    redirect("/setup");
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Spinner className="size-5 text-sachi-fg-muted" />
        </div>
      }
    >
      <InboxContent />
    </Suspense>
  );
}
