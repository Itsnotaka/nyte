"use client";

import { Button } from "@nyte/ui/components/button";
import { ScrollArea } from "@nyte/ui/components/scroll-area";
import { useQuery } from "convex/react";

import { authClient } from "~/lib/auth-client";
import { api } from "~/lib/convex";

import { useFeedContext } from "./feed-provider";
import { FeedSkeleton } from "./feed-skeleton";
import { WorkItemCard } from "./work-item-card";

export function NotificationFeed() {
  const { actionError, clearActionError } = useFeedContext();
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const connected = (session?.user?.id?.trim().length ?? 0) > 0;
  const feed = useQuery(api.queue.feed, connected ? {} : "skip");

  if (isSessionPending || !connected || feed === undefined) {
    return <FeedSkeleton />;
  }

  const approvalQueue = feed.approvalQueue;

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      {actionError ? (
        <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-main-bg)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
          <div className="flex items-center justify-between gap-3">
            <p>{actionError}</p>
            <Button variant="ghost" size="xs" onClick={clearActionError}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
        <p>
          {approvalQueue.length} important{" "}
          {approvalQueue.length === 1 ? "item" : "items"} today
        </p>
      </div>

      {approvalQueue.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-main-bg)] p-6 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">
            No important items right now.
          </p>
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1 pr-1">
          <ul className="space-y-3 pb-2">
            {approvalQueue.map((item: (typeof approvalQueue)[number]) => (
              <li
                key={item.id}
                className="work-item-card"
                style={{
                  contentVisibility: "auto",
                  containIntrinsicSize: "0 120px",
                }}
              >
                <WorkItemCard item={item} />
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </section>
  );
}
