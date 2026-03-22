"use client";

import { useQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { useEffect } from "react";

import { useTRPC } from "~/lib/trpc/react";

import { InboxDetail } from "./inbox-detail";
import { prState, readPr } from "./inbox-pr";
import { InboxView } from "./inbox-view";

export function InboxWorkspace() {
  const trpc = useTRPC();
  const [pr, setPr] = useQueryState("pr", prState);
  const pick = readPr(pr);
  const inboxQuery = useQuery({
    ...trpc.github.getInboxData.queryOptions(),
    gcTime: 5 * 60_000,
    staleTime: 60_000,
  });
  const sectionOrderQuery = useQuery({
    ...trpc.settings.getInboxSectionOrder.queryOptions(),
    gcTime: 5 * 60_000,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (pr == null || pick != null) {
      return;
    }

    void setPr(null, { history: "replace" });
  }, [pick, pr, setPr]);

  if (inboxQuery.error) {
    throw inboxQuery.error;
  }

  if (sectionOrderQuery.error) {
    throw sectionOrderQuery.error;
  }

  if (inboxQuery.status === "success" && inboxQuery.data == null) {
    return null;
  }

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden bg-sachi-base">
      <div className="min-w-0 flex-1 xl:flex-[2_1_0%]">
        <InboxView
          data={inboxQuery.data ?? undefined}
          onOpen={(value) => {
            void setPr(value);
          }}
          sectionOrder={sectionOrderQuery.data}
          selected={pr}
        />
      </div>

      {pick ? (
        <div className="absolute inset-0 z-10 flex min-h-0 min-w-0 overflow-hidden bg-sachi-surface xl:static xl:flex-[3_1_0%] xl:border-l xl:border-sachi-line-subtle">
          <InboxDetail
            owner={pick.owner}
            repo={pick.repo}
            pullNumber={pick.number}
            onClose={() => {
              void setPr(null, { history: "replace" });
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
