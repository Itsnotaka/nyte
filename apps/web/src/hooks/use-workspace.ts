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
import { QUEUE_MESSAGES, formatSyncFilteredNotice } from "~/lib/queue/messages";
import { useTRPC, useTRPCClient } from "~/lib/trpc";

const MIN_WATCH_KEYWORD_LENGTH = 3;
const MAX_WATCH_KEYWORDS = 8;

type ActionStatus = "approved" | "dismissed";

export type UseWorkspaceResult = {
  connected: boolean;
  isSessionPending: boolean;
  isSyncing: boolean;
  isMutating: boolean;
  error: string | null;
  notice: string | null;
  lastSyncedAt: string | null;
  activeWatchKeywords: string[];
  items: WorkItemWithAction[];
  runSync: (command: string) => Promise<void>;
  connectGoogle: () => Promise<void>;
  disconnectGoogle: () => Promise<void>;
  markAction: (
    item: WorkItemWithAction,
    status: ActionStatus,
    payloadOverride?: ToolCallPayload
  ) => Promise<void>;
};

function areKeywordsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (const [index, keyword] of left.entries()) {
    if (keyword !== right[index]) {
      return false;
    }
  }

  return true;
}

function parseWatchKeywordCommand(command: string): string[] {
  const normalized = command.trim();
  if (!normalized) {
    return [];
  }

  const candidates = normalized.includes(",")
    ? normalized.split(",")
    : normalized.split(/\s+/);
  const keywords = new Set<string>();

  for (const entry of candidates) {
    const keyword = entry.trim().toLowerCase();
    if (keyword.length < MIN_WATCH_KEYWORD_LENGTH) {
      continue;
    }

    keywords.add(keyword);
    if (keywords.size >= MAX_WATCH_KEYWORDS) {
      break;
    }
  }

  return Array.from(keywords);
}

export function useWorkspace(): UseWorkspaceResult {
  const router = useRouter();
  const trpc = useTRPC();
  const client = useTRPCClient();
  const queryClient = useQueryClient();

  const [activeWatchKeywords, setActiveWatchKeywords] = React.useState<
    string[]
  >([]);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [mutationError, setMutationError] = React.useState<string | null>(null);

  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const userId = session?.user?.id ?? null;
  const connected = Boolean(session);

  const {
    data: syncPages,
    error: syncQueryError,
    isFetching: isSyncing,
    dataUpdatedAt,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["workspace.sync", userId, activeWatchKeywords],
    enabled: connected,
    retry: false,
    refetchOnWindowFocus: false,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      client.queue.sync.query({
        cursor: pageParam,
        watchKeywords: activeWatchKeywords,
      }),
    getNextPageParam: (lastPage) => lastPage.cursor,
    maxPages: 1,
  });

  const syncData = syncPages?.pages.at(-1);

  const items = connected ? (syncData?.approvalQueue ?? []) : [];

  const error = React.useMemo(() => {
    if (mutationError) return mutationError;
    if (!syncQueryError) return null;
    return syncQueryError instanceof Error && syncQueryError.message.trim()
      ? syncQueryError.message
      : QUEUE_MESSAGES.syncUnavailable;
  }, [mutationError, syncQueryError]);

  const lastSyncedAt = syncData ? new Date(dataUpdatedAt).toISOString() : null;

  const approveMutation = useMutation(trpc.actions.approve.mutationOptions());
  const dismissMutation = useMutation(trpc.actions.dismiss.mutationOptions());

  const fetchLatestSyncPage = React.useCallback(async () => {
    await fetchNextPage();
  }, [fetchNextPage]);

  const runSync = React.useCallback(
    async (command: string) => {
      setNotice(null);
      setMutationError(null);
      const keywords = parseWatchKeywordCommand(command);

      const keywordsChanged = !areKeywordsEqual(activeWatchKeywords, keywords);
      setActiveWatchKeywords(keywords);

      if (!keywordsChanged) {
        await fetchLatestSyncPage();
      }

      if (keywords.length > 0) {
        setNotice(formatSyncFilteredNotice(keywords));
      }
    },
    [activeWatchKeywords, fetchLatestSyncPage]
  );

  const connectGoogle = React.useCallback(async () => {
    setNotice(null);
    setMutationError(null);
    setActiveWatchKeywords([]);
    queryClient.removeQueries({ queryKey: ["workspace.sync", userId] });
    await authClient.signIn.social({
      provider: GOOGLE_AUTH_PROVIDER,
      callbackURL: "/",
    });
  }, [queryClient, userId]);

  const disconnectGoogle = React.useCallback(async () => {
    await authClient.signOut();
    setMutationError(null);
    setActiveWatchKeywords([]);
    queryClient.removeQueries({ queryKey: ["workspace.sync", userId] });
    router.refresh();
  }, [queryClient, router, userId]);

  const markAction = React.useCallback(
    async (
      item: WorkItemWithAction,
      status: ActionStatus,
      payloadOverride?: ToolCallPayload
    ) => {
      setNotice(null);
      setMutationError(null);
      try {
        if (status === "approved") {
          await approveMutation.mutateAsync({
            itemId: item.id,
            payloadOverride,
          });
        } else {
          await dismissMutation.mutateAsync({ itemId: item.id });
        }
        await fetchLatestSyncPage();
        setNotice(
          status === "approved"
            ? QUEUE_MESSAGES.actionApprovedNotice
            : QUEUE_MESSAGES.actionDismissedNotice
        );
      } catch (err) {
        const message =
          err instanceof Error && err.message.trim()
            ? err.message
            : QUEUE_MESSAGES.actionUpdateUnavailable;
        setMutationError(message);
      }
    },
    [approveMutation, dismissMutation, fetchLatestSyncPage]
  );

  return {
    connected,
    isSessionPending,
    isSyncing,
    isMutating: approveMutation.isPending || dismissMutation.isPending,
    error,
    notice,
    lastSyncedAt,
    activeWatchKeywords,
    items,
    runSync,
    connectGoogle,
    disconnectGoogle,
    markAction,
  };
}
