"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WorkItemWithAction } from "@nyte/domain/actions";
import type { QueueSyncResponse } from "@nyte/workflows";
import * as React from "react";

import { authClient } from "~/lib/auth-client";
import { approveNeedsYouAction, dismissNeedsYouAction } from "~/lib/needs-you/actions-client";
import { syncNeedsYou } from "~/lib/needs-you/sync-client";

type UseNyteWorkspaceInput = {
  initialConnected: boolean;
};

export type UseNyteWorkspaceResult = {
  connected: boolean;
  isSessionPending: boolean;
  isSyncing: boolean;
  isMutating: boolean;
  syncError: string | null;
  notice: string | null;
  lastSyncedAt: string | null;
  visibleItems: WorkItemWithAction[];
  runSync: () => Promise<void>;
  connectGoogle: () => Promise<void>;
  disconnectGoogle: () => Promise<void>;
  markAction: (item: WorkItemWithAction, status: "approved" | "dismissed") => Promise<void>;
};

type UserScopedMessage = {
  userId: string | null;
  value: string;
};

function resolveSessionUserId(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const user = (value as { user?: unknown }).user;
  if (!user || typeof user !== "object" || Array.isArray(user)) {
    return null;
  }

  const userId = (user as { id?: unknown }).id;
  if (typeof userId !== "string" || userId.trim().length === 0) {
    return null;
  }

  return userId;
}

export function useNyteWorkspace({
  initialConnected,
}: UseNyteWorkspaceInput): UseNyteWorkspaceResult {
  const queryClient = useQueryClient();
  const [noticeState, setNoticeState] = React.useState<UserScopedMessage | null>(null);
  const [mutationErrorState, setMutationErrorState] = React.useState<UserScopedMessage | null>(null);

  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const sessionUserId = React.useMemo(() => resolveSessionUserId(session), [session]);
  const syncQueryKey = React.useMemo(
    () => ["needs-you-sync", sessionUserId ?? "anonymous"] as const,
    [sessionUserId],
  );

  const connected = isSessionPending ? initialConnected : Boolean(session);
  const notice =
    noticeState?.userId === sessionUserId
      ? noticeState.value
      : null;
  const mutationError =
    mutationErrorState?.userId === sessionUserId
      ? mutationErrorState.value
      : null;

  const setNotice = React.useCallback(
    (value: string | null) => {
      setNoticeState(value ? { userId: sessionUserId, value } : null);
    },
    [sessionUserId],
  );
  const setMutationError = React.useCallback(
    (value: string | null) => {
      setMutationErrorState(value ? { userId: sessionUserId, value } : null);
    },
    [sessionUserId],
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
      const currentPayload = queryClient.getQueryData<QueueSyncResponse>(syncQueryKey);
      return syncNeedsYou(currentPayload?.cursor ?? null);
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

    return syncQueryError instanceof Error && syncQueryError.message.trim().length > 0
      ? syncQueryError.message
      : "Unable to sync Gmail + Calendar right now.";
  }, [mutationError, syncQueryError]);

  const lastSyncedAt = syncPayload ? new Date(dataUpdatedAt).toISOString() : null;

  const approveMutation = useMutation({
    mutationFn: approveNeedsYouAction,
  });
  const dismissMutation = useMutation({
    mutationFn: dismissNeedsYouAction,
  });

  const runSync = React.useCallback(async () => {
    setNotice(null);
    setMutationError(null);
    await refetchSync();
  }, [refetchSync]);

  const connectGoogle = React.useCallback(async () => {
    setNotice(null);
    setMutationError(null);
    await queryClient.resetQueries({
      queryKey: syncQueryKey,
      exact: true,
    });
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
    });
  }, [queryClient, syncQueryKey]);

  const disconnectGoogle = React.useCallback(async () => {
    await authClient.signOut();
    setMutationError(null);
    setNotice("Disconnected Google session.");
    queryClient.removeQueries({
      queryKey: syncQueryKey,
      exact: true,
    });
  }, [queryClient, syncQueryKey]);

  const markAction = React.useCallback(
    async (item: WorkItemWithAction, status: "approved" | "dismissed") => {
      setNotice(null);
      setMutationError(null);

      try {
        if (status === "approved") {
          await approveMutation.mutateAsync(item.id);
        } else {
          await dismissMutation.mutateAsync(item.id);
        }

        await queryClient.invalidateQueries({
          queryKey: syncQueryKey,
          exact: true,
        });
        await refetchSync();
        setNotice(status === "approved" ? "Action approved." : "Action dismissed.");
      } catch (error) {
        const message =
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : "Unable to update action status.";
        setMutationError(message);
      }
    },
    [approveMutation, dismissMutation, queryClient, refetchSync, syncQueryKey],
  );

  return {
    connected,
    isSessionPending,
    isSyncing,
    isMutating: approveMutation.isPending || dismissMutation.isPending,
    syncError,
    notice,
    lastSyncedAt,
    visibleItems,
    runSync,
    connectGoogle,
    disconnectGoogle,
    markAction,
  };
}
