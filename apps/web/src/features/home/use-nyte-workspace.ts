"use client";

import type { ToolCallPayload, WorkItemWithAction } from "@nyte/domain/actions";
import type { QueueSyncRequest, QueueSyncResponse } from "@nyte/workflows";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";

import { authClient } from "~/lib/auth-client";
import { GOOGLE_AUTH_PROVIDER } from "~/lib/auth-provider";
import {
  approveNeedsYouAction,
  dismissNeedsYouAction,
} from "~/lib/needs-you/actions-client";
import {
  formatSyncFilteredNotice,
  NEEDS_YOU_MESSAGES,
} from "~/lib/needs-you/messages";
import { syncNeedsYou } from "~/lib/needs-you/sync-client";
import { resolveSessionUserId } from "~/lib/shared/session-user-id";
import { parseWatchKeywordCommand } from "~/lib/shared/watch-keywords";

type UseNyteWorkspaceInput = {
  initialConnected: boolean;
};

type ActionMutationStatus = "approved" | "dismissed";

type WatchKeywords = NonNullable<QueueSyncRequest["watchKeywords"]>;

export type UseNyteWorkspaceResult = {
  connected: boolean;
  isSessionPending: boolean;
  isSyncing: boolean;
  isMutating: boolean;
  syncError: string | null;
  notice: string | null;
  lastSyncedAt: string | null;
  activeWatchKeywords: WatchKeywords;
  visibleItems: WorkItemWithAction[];
  runSync: (command: string) => Promise<void>;
  connectGoogle: () => Promise<void>;
  disconnectGoogle: () => Promise<void>;
  markAction: (
    item: WorkItemWithAction,
    status: ActionMutationStatus,
    payloadOverride?: ToolCallPayload
  ) => Promise<void>;
};

type UserScopedMessage = {
  userId: string | null;
  value: string;
};

export function useNyteWorkspace({
  initialConnected,
}: UseNyteWorkspaceInput): UseNyteWorkspaceResult {
  const router = useRouter();
  const queryClient = useQueryClient();
  const watchKeywordsRef = React.useRef<WatchKeywords>([]);
  const [activeWatchKeywords, setActiveWatchKeywords] =
    React.useState<WatchKeywords>([]);
  const [noticeState, setNoticeState] =
    React.useState<UserScopedMessage | null>(null);
  const [mutationErrorState, setMutationErrorState] =
    React.useState<UserScopedMessage | null>(null);

  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const sessionUserId = React.useMemo(
    () => resolveSessionUserId(session),
    [session]
  );
  const syncQueryKey = React.useMemo(
    () => ["needs-you-sync", sessionUserId ?? "anonymous"] as const,
    [sessionUserId]
  );

  const connected = isSessionPending ? initialConnected : Boolean(session);
  const notice =
    noticeState?.userId === sessionUserId ? noticeState.value : null;
  const mutationError =
    mutationErrorState?.userId === sessionUserId
      ? mutationErrorState.value
      : null;

  const setNotice = React.useCallback(
    (value: string | null) => {
      setNoticeState(value ? { userId: sessionUserId, value } : null);
    },
    [sessionUserId]
  );
  const setMutationError = React.useCallback(
    (value: string | null) => {
      setMutationErrorState(value ? { userId: sessionUserId, value } : null);
    },
    [sessionUserId]
  );

  const {
    data: syncPayload,
    error: syncQueryError,
    isFetching: isSyncing,
    refetch: refetchSync,
    dataUpdatedAt,
  } = useQuery({
    queryKey: syncQueryKey,
    enabled: connected,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const currentPayload =
        queryClient.getQueryData<QueueSyncResponse>(syncQueryKey);
      return syncNeedsYou({
        cursor: currentPayload?.cursor,
        watchKeywords: watchKeywordsRef.current,
      });
    },
  });

  const visibleItems = connected ? (syncPayload?.needsYou ?? []) : [];

  const syncError = React.useMemo(() => {
    if (mutationError) {
      return mutationError;
    }

    if (!syncQueryError) {
      return null;
    }

    return syncQueryError instanceof Error &&
      syncQueryError.message.trim().length > 0
      ? syncQueryError.message
      : NEEDS_YOU_MESSAGES.syncUnavailable;
  }, [mutationError, syncQueryError]);

  const lastSyncedAt = syncPayload
    ? new Date(dataUpdatedAt).toISOString()
    : null;

  const approveMutation = useMutation({
    mutationFn: async ({
      itemId,
      payloadOverride,
    }: {
      itemId: string;
      payloadOverride?: ToolCallPayload;
    }) => approveNeedsYouAction(itemId, payloadOverride),
  });
  const dismissMutation = useMutation({
    mutationFn: dismissNeedsYouAction,
  });

  const runSync = React.useCallback(
    async (command: string) => {
      setNotice(null);
      setMutationError(null);
      const parsedKeywords = parseWatchKeywordCommand(command);
      watchKeywordsRef.current = parsedKeywords;
      setActiveWatchKeywords(parsedKeywords);
      const result = await refetchSync();
      if (!result.error && parsedKeywords.length > 0) {
        setNotice(formatSyncFilteredNotice(parsedKeywords));
      }
    },
    [refetchSync, setMutationError, setNotice]
  );

  const connectGoogle = React.useCallback(async () => {
    setNotice(null);
    setMutationError(null);
    watchKeywordsRef.current = [];
    setActiveWatchKeywords([]);
    await queryClient.resetQueries({
      queryKey: syncQueryKey,
      exact: true,
    });
    await authClient.signIn.social({
      provider: GOOGLE_AUTH_PROVIDER,
      callbackURL: "/",
    });
  }, [queryClient, setMutationError, setNotice, syncQueryKey]);

  const disconnectGoogle = React.useCallback(async () => {
    await authClient.signOut();
    setMutationError(null);
    watchKeywordsRef.current = [];
    setActiveWatchKeywords([]);
    queryClient.removeQueries({
      queryKey: syncQueryKey,
      exact: true,
    });
    router.refresh();
  }, [queryClient, router, setMutationError, syncQueryKey]);

  const markAction = React.useCallback(
    async (
      item: WorkItemWithAction,
      status: ActionMutationStatus,
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
          await dismissMutation.mutateAsync(item.id);
        }

        await queryClient.invalidateQueries({
          queryKey: syncQueryKey,
          exact: true,
        });
        await refetchSync();
        setNotice(
          status === "approved"
            ? NEEDS_YOU_MESSAGES.actionApprovedNotice
            : NEEDS_YOU_MESSAGES.actionDismissedNotice
        );
      } catch (error) {
        const message =
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : NEEDS_YOU_MESSAGES.actionUpdateUnavailable;
        setMutationError(message);
      }
    },
    [
      approveMutation,
      dismissMutation,
      queryClient,
      refetchSync,
      setMutationError,
      setNotice,
      syncQueryKey,
    ]
  );

  return {
    connected,
    isSessionPending,
    isSyncing,
    isMutating: approveMutation.isPending || dismissMutation.isPending,
    syncError,
    notice,
    lastSyncedAt,
    activeWatchKeywords,
    visibleItems,
    runSync,
    connectGoogle,
    disconnectGoogle,
    markAction,
  };
}
