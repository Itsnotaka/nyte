"use client";

import type { ToolCallPayload, WorkItemWithAction } from "@nyte/domain/actions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";

import { authClient } from "~/lib/auth-client";
import { GOOGLE_AUTH_PROVIDER } from "~/lib/auth-provider";
import { QUEUE_MESSAGES, formatSyncFilteredNotice } from "~/lib/queue/messages";
import { resolveSessionUserId } from "~/lib/shared/session-user-id";
import { parseWatchKeywordCommand } from "~/lib/shared/watch-keywords";
import { useTRPC, useTRPCClient } from "~/lib/trpc";

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
  markAction: (item: WorkItemWithAction, status: ActionStatus, payloadOverride?: ToolCallPayload) => Promise<void>;
};

export function useWorkspace(): UseWorkspaceResult {
  const router = useRouter();
  const trpc = useTRPC();
  const client = useTRPCClient();
  const queryClient = useQueryClient();

  const watchKeywordsRef = React.useRef<string[]>([]);
  const [activeWatchKeywords, setActiveWatchKeywords] = React.useState<string[]>([]);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [mutationError, setMutationError] = React.useState<string | null>(null);

  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const userId = React.useMemo(() => resolveSessionUserId(session), [session]);
  const connected = Boolean(session);

  const {
    data: syncData,
    error: syncQueryError,
    isFetching: isSyncing,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["workspace.sync", userId],
    enabled: connected,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const cached = queryClient.getQueryData<{ cursor?: string }>(["workspace.sync", userId]);
      return client.queue.sync.query({
        cursor: cached?.cursor,
        watchKeywords: watchKeywordsRef.current,
      });
    },
  });

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

  const refetchSync = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["workspace.sync", userId] });
    await queryClient.refetchQueries({ queryKey: ["workspace.sync", userId] });
  }, [queryClient, userId]);

  const runSync = React.useCallback(async (command: string) => {
    setNotice(null);
    setMutationError(null);
    const keywords = parseWatchKeywordCommand(command);
    watchKeywordsRef.current = keywords;
    setActiveWatchKeywords(keywords);
    await refetchSync();
    if (keywords.length > 0) {
      setNotice(formatSyncFilteredNotice(keywords));
    }
  }, [refetchSync]);

  const connectGoogle = React.useCallback(async () => {
    setNotice(null);
    setMutationError(null);
    watchKeywordsRef.current = [];
    setActiveWatchKeywords([]);
    queryClient.removeQueries({ queryKey: ["workspace.sync", userId] });
    await authClient.signIn.social({ provider: GOOGLE_AUTH_PROVIDER, callbackURL: "/" });
  }, [queryClient, userId]);

  const disconnectGoogle = React.useCallback(async () => {
    await authClient.signOut();
    setMutationError(null);
    watchKeywordsRef.current = [];
    setActiveWatchKeywords([]);
    queryClient.removeQueries({ queryKey: ["workspace.sync", userId] });
    router.refresh();
  }, [queryClient, router, userId]);

  const markAction = React.useCallback(async (
    item: WorkItemWithAction,
    status: ActionStatus,
    payloadOverride?: ToolCallPayload
  ) => {
    setNotice(null);
    setMutationError(null);
    try {
      if (status === "approved") {
        await approveMutation.mutateAsync({ itemId: item.id, payloadOverride });
      } else {
        await dismissMutation.mutateAsync({ itemId: item.id });
      }
      await refetchSync();
      setNotice(
        status === "approved"
          ? QUEUE_MESSAGES.actionApprovedNotice
          : QUEUE_MESSAGES.actionDismissedNotice
      );
    } catch (err) {
      const message = err instanceof Error && err.message.trim()
        ? err.message
        : QUEUE_MESSAGES.actionUpdateUnavailable;
      setMutationError(message);
    }
  }, [approveMutation, dismissMutation, refetchSync]);

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
