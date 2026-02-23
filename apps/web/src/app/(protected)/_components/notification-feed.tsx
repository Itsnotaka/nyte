"use client";

import { Button } from "@nyte/ui/components/button";
import { ScrollArea } from "@nyte/ui/components/scroll-area";
import { Spinner } from "@nyte/ui/components/spinner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "~/lib/trpc";

import { useFeedContext } from "./feed-provider";
import { FeedSkeleton } from "./feed-skeleton";
import { WorkItemCard } from "./work-item-card";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message.length > 0) {
      return message;
    }
  }

  return "Unable to load your queue right now.";
}

export function NotificationFeed() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { actionError, clearActionError } = useFeedContext();

  const feedQuery = useQuery(
    trpc.queue.feed.queryOptions(undefined, {
      retry: false,
    })
  );
  const feedQueryKey = trpc.queue.feed.queryKey(undefined);
  const syncMutation = useMutation({
    mutationFn: async (force: boolean) => {
      await queryClient.fetchQuery(trpc.queue.sync.queryOptions({ force }));
      await queryClient.invalidateQueries({
        queryKey: feedQueryKey,
      });
    },
  });
  const staleMarker = feedQuery.data?.lastSyncedAt ?? "never";
  useQuery({
    queryKey: ["queue.sync.auto", staleMarker],
    enabled: (feedQuery.data?.isStale ?? false) && !syncMutation.isPending,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
    queryFn: async () => {
      await queryClient.fetchQuery(
        trpc.queue.sync.queryOptions({ force: false })
      );
      await queryClient.invalidateQueries({ queryKey: feedQueryKey });
      return true;
    },
  });

  if (feedQuery.isPending) {
    return <FeedSkeleton />;
  }

  if (feedQuery.isError) {
    return (
      <section className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-main-bg)] p-4">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {toErrorMessage(feedQuery.error)}
        </p>
        <div className="mt-3 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void syncMutation.mutateAsync(true);
            }}
          >
            Retry
          </Button>
        </div>
      </section>
    );
  }

  const approvalQueue = feedQuery.data.approvalQueue;

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
          {approvalQueue.length} pending{" "}
          {approvalQueue.length === 1 ? "item" : "items"}
        </p>
        <Button
          variant="ghost"
          size="sm"
          disabled={feedQuery.isFetching || syncMutation.isPending}
          onClick={() => {
            void syncMutation.mutateAsync(true);
          }}
        >
          {feedQuery.isFetching || syncMutation.isPending ? (
            <span className="inline-flex items-center gap-1.5">
              <Spinner className="size-3.5" />
              Syncing
            </span>
          ) : (
            "Refresh"
          )}
        </Button>
      </div>

      {approvalQueue.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-main-bg)] p-6 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Nothing pending right now.
          </p>
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1 pr-1">
          <ul className="space-y-3 pb-2">
            {approvalQueue.map((item) => (
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
