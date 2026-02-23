"use client";

import type { WorkItemWithAction } from "@nyte/domain/actions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, use, useCallback, useMemo, useState } from "react";

import { useTRPC } from "~/lib/trpc";

type QueueFeedResponse = {
  approvalQueue: WorkItemWithAction[];
  lastSyncedAt: string | null;
  isStale: boolean;
};

type FeedContextValue = {
  approve: (itemId: string) => Promise<void>;
  dismiss: (itemId: string) => Promise<void>;
  pendingIds: Set<string>;
  actionError: string | null;
  clearActionError: () => void;
};

type MutationContext = {
  previous: QueueFeedResponse | undefined;
  itemId: string;
};

const FeedContext = createContext<FeedContextValue | null>(null);

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message.length > 0) {
      return message;
    }
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    const message = (error as { message: string }).message.trim();
    if (message.length > 0) {
      return message;
    }
  }

  return fallback;
}

function removeQueueItem(
  data: QueueFeedResponse | undefined,
  itemId: string
): QueueFeedResponse | undefined {
  if (!data) {
    return data;
  }

  return {
    ...data,
    approvalQueue: data.approvalQueue.filter((item) => item.id !== itemId),
  };
}

export function FeedProvider({ children }: { children: React.ReactNode }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  const queueFeedQueryKey = trpc.queue.feed.queryKey(undefined);

  const updatePendingState = useCallback(
    (itemId: string, isPending: boolean) => {
      setPendingIds((previous) => {
        const next = new Set(previous);
        if (isPending) {
          next.add(itemId);
        } else {
          next.delete(itemId);
        }
        return next;
      });
    },
    []
  );

  const approveMutation = useMutation(
    trpc.actions.approve.mutationOptions({
      onMutate: async ({ itemId }) => {
        updatePendingState(itemId, true);
        await queryClient.cancelQueries({ queryKey: queueFeedQueryKey });

        const previous =
          queryClient.getQueryData<QueueFeedResponse>(queueFeedQueryKey);
        queryClient.setQueryData<QueueFeedResponse | undefined>(
          queueFeedQueryKey,
          (old) => removeQueueItem(old, itemId)
        );

        return { previous, itemId } satisfies MutationContext;
      },
      onError: (error, _variables, context) => {
        setActionError(toErrorMessage(error, "Unable to approve this item."));
        if (context?.previous) {
          queryClient.setQueryData(queueFeedQueryKey, context.previous);
        }
      },
      onSettled: (_data, _error, variables, context) => {
        const itemId = context?.itemId ?? variables.itemId;
        updatePendingState(itemId, false);
        void queryClient.invalidateQueries({ queryKey: queueFeedQueryKey });
      },
    })
  );

  const dismissMutation = useMutation(
    trpc.actions.dismiss.mutationOptions({
      onMutate: async ({ itemId }) => {
        updatePendingState(itemId, true);
        await queryClient.cancelQueries({ queryKey: queueFeedQueryKey });

        const previous =
          queryClient.getQueryData<QueueFeedResponse>(queueFeedQueryKey);
        queryClient.setQueryData<QueueFeedResponse | undefined>(
          queueFeedQueryKey,
          (old) => removeQueueItem(old, itemId)
        );

        return { previous, itemId } satisfies MutationContext;
      },
      onError: (error, _variables, context) => {
        setActionError(toErrorMessage(error, "Unable to dismiss this item."));
        if (context?.previous) {
          queryClient.setQueryData(queueFeedQueryKey, context.previous);
        }
      },
      onSettled: (_data, _error, variables, context) => {
        const itemId = context?.itemId ?? variables.itemId;
        updatePendingState(itemId, false);
        void queryClient.invalidateQueries({ queryKey: queueFeedQueryKey });
      },
    })
  );

  const approve = useCallback(
    async (itemId: string) => {
      setActionError(null);
      try {
        await approveMutation.mutateAsync({ itemId });
      } catch {}
    },
    [approveMutation]
  );

  const dismiss = useCallback(
    async (itemId: string) => {
      setActionError(null);
      try {
        await dismissMutation.mutateAsync({ itemId });
      } catch {}
    },
    [dismissMutation]
  );

  const clearActionError = useCallback(() => {
    setActionError(null);
  }, []);

  const value = useMemo(
    () => ({
      approve,
      dismiss,
      pendingIds,
      actionError,
      clearActionError,
    }),
    [actionError, approve, clearActionError, dismiss, pendingIds]
  );

  return <FeedContext value={value}>{children}</FeedContext>;
}

export function useFeedContext(): FeedContextValue {
  const context = use(FeedContext);
  if (!context) {
    throw new Error("useFeedContext must be used inside FeedProvider.");
  }

  return context;
}
