"use client";

import type { ToolCallPayload, WorkItemWithAction } from "@nyte/domain/actions";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";

import { authClient } from "~/lib/auth-client";
import { GOOGLE_AUTH_PROVIDER } from "~/lib/auth-provider";
import { useTRPC, useTRPCClient } from "~/lib/trpc";

const BACKGROUND_REFETCH_INTERVAL = 60_000;

type ActionStatus = "approved" | "dismissed";

export type UseChatResult = {
  connected: boolean;
  isSessionPending: boolean;
  isLoading: boolean;
  isActing: boolean;
  error: string | null;
  items: WorkItemWithAction[];
  refresh: () => Promise<void>;
  markAction: (
    item: WorkItemWithAction,
    status: ActionStatus,
    payloadOverride?: ToolCallPayload
  ) => Promise<void>;
  connectGoogle: () => Promise<void>;
  disconnectGoogle: () => Promise<void>;
};

export function useChat(): UseChatResult {
  const router = useRouter();
  const trpc = useTRPC();
  const client = useTRPCClient();
  const queryClient = useQueryClient();

  const [mutationError, setMutationError] = React.useState<string | null>(null);

  // Optimistic dismissal — items hidden immediately on action, cleared when server confirms.
  // Pattern from pi-mono: agent.appendMessage() fires before server round-trip completes.
  const [actedIds, setActedIds] = React.useState<Set<string>>(new Set());

  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const userId = session?.user?.id ?? null;
  const connected = Boolean(session);

  const {
    data: syncPages,
    error: syncQueryError,
    isFetching: isLoading,
    dataUpdatedAt,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["chat.sync", userId],
    enabled: connected,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: BACKGROUND_REFETCH_INTERVAL,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      client.queue.sync.query({ cursor: pageParam, watchKeywords: [] }),
    getNextPageParam: (lastPage) => lastPage.cursor,
    maxPages: 1,
  });

  // Clear optimistic state when server data refreshes.
  // Same principle as pi-mono agent_end clearing streaming state.
  React.useEffect(() => {
    setActedIds(new Set());
  }, [dataUpdatedAt]);

  const serverItems = connected
    ? (syncPages?.pages.at(-1)?.approvalQueue ?? [])
    : [];
  const items = serverItems.filter((item) => !actedIds.has(item.id));

  const error = React.useMemo(() => {
    if (mutationError) return mutationError;
    if (!syncQueryError) return null;
    return syncQueryError instanceof Error && syncQueryError.message.trim()
      ? syncQueryError.message
      : "Unable to connect right now.";
  }, [mutationError, syncQueryError]);

  const approveMutation = useMutation(trpc.actions.approve.mutationOptions());
  const dismissMutation = useMutation(trpc.actions.dismiss.mutationOptions());

  const refresh = React.useCallback(async () => {
    await fetchNextPage();
  }, [fetchNextPage]);

  const connectGoogle = React.useCallback(async () => {
    setMutationError(null);
    queryClient.removeQueries({ queryKey: ["chat.sync", userId] });
    try {
      await authClient.signIn.social({
        provider: GOOGLE_AUTH_PROVIDER,
        callbackURL: "/",
      });
    } catch {
      setMutationError("Unable to connect Google right now.");
    }
  }, [queryClient, userId]);

  const disconnectGoogle = React.useCallback(async () => {
    setMutationError(null);
    try {
      await authClient.signOut();
      queryClient.removeQueries({ queryKey: ["chat.sync", userId] });
      router.refresh();
    } catch {
      setMutationError("Unable to disconnect right now.");
    }
  }, [queryClient, router, userId]);

  const markAction = React.useCallback(
    async (
      item: WorkItemWithAction,
      status: ActionStatus,
      payloadOverride?: ToolCallPayload
    ) => {
      setMutationError(null);

      // Optimistically hide item before server round-trip.
      setActedIds((prev) => new Set([...prev, item.id]));

      try {
        if (status === "approved") {
          await approveMutation.mutateAsync({
            itemId: item.id,
            payloadOverride,
          });
        } else {
          await dismissMutation.mutateAsync({ itemId: item.id });
        }
        await refresh();
      } catch (err) {
        // Restore item on failure.
        setActedIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        setMutationError(
          err instanceof Error && err.message.trim()
            ? err.message
            : "Unable to complete that action."
        );
      }
    },
    [approveMutation, dismissMutation, refresh]
  );

  return {
    connected,
    isSessionPending,
    isLoading,
    isActing: approveMutation.isPending || dismissMutation.isPending,
    error,
    items,
    refresh,
    markAction,
    connectGoogle,
    disconnectGoogle,
  };
}
