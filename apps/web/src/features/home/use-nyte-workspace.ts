"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { WorkItemWithAction } from "@nyte/domain/actions";
import * as React from "react";

import { authClient } from "~/lib/auth-client";
import { syncNeedsYou } from "~/lib/needs-you/sync-client";

const DEFAULT_COMMAND =
  "Gmail draft an email to our largest customer about the renewal timeline and next steps";

type UseNyteWorkspaceInput = {
  initialConnected: boolean;
};

export type UseNyteWorkspaceResult = {
  command: string;
  connected: boolean;
  isSessionPending: boolean;
  isSyncing: boolean;
  syncError: string | null;
  notice: string | null;
  lastSyncedAt: string | null;
  visibleItems: WorkItemWithAction[];
  setCommand: (value: string) => void;
  runSync: () => Promise<void>;
  connectGoogle: () => Promise<void>;
  disconnectGoogle: () => Promise<void>;
  markAction: (item: WorkItemWithAction, status: "approved" | "dismissed") => void;
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
  const [command, setCommand] = React.useState(DEFAULT_COMMAND);
  const [handled, setHandled] = React.useState<Record<string, "approved" | "dismissed">>({});
  const [notice, setNotice] = React.useState<string | null>(null);
  const cursorRef = React.useRef<string | null>(null);

  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const sessionUserId = React.useMemo(() => resolveSessionUserId(session), [session]);
  const syncQueryKey = React.useMemo(
    () => ["needs-you-sync", sessionUserId ?? "anonymous"] as const,
    [sessionUserId],
  );

  const connected = isSessionPending ? initialConnected : Boolean(session);

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
      const payload = await syncNeedsYou(cursorRef.current);
      cursorRef.current = payload.cursor;
      return payload;
    },
  });

  React.useEffect(() => {
    cursorRef.current = null;
    setHandled({});
    setNotice(null);
  }, [sessionUserId]);

  const items = connected ? (syncPayload?.needsYou ?? []) : [];

  const visibleItems = React.useMemo(
    () => items.filter((item) => handled[item.id] === undefined),
    [handled, items],
  );

  const syncError = React.useMemo(() => {
    if (!syncQueryError) {
      return null;
    }

    return syncQueryError instanceof Error && syncQueryError.message.trim().length > 0
      ? syncQueryError.message
      : "Unable to sync Gmail + Calendar right now.";
  }, [syncQueryError]);

  const lastSyncedAt = syncPayload ? new Date(dataUpdatedAt).toISOString() : null;

  const runSync = React.useCallback(async () => {
    setNotice(null);
    const result = await refetchSync();
    if (!result.error) {
      setHandled({});
    }
  }, [refetchSync]);

  const connectGoogle = React.useCallback(async () => {
    setNotice(null);
    cursorRef.current = null;
    setHandled({});
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
    cursorRef.current = null;
    setHandled({});
    setNotice("Disconnected Google session.");
    queryClient.removeQueries({
      queryKey: syncQueryKey,
      exact: true,
    });
  }, [queryClient, syncQueryKey]);

  const markAction = React.useCallback(
    (item: WorkItemWithAction, status: "approved" | "dismissed") => {
      setHandled((current) => ({
        ...current,
        [item.id]: status,
      }));

      setNotice(
        status === "approved"
          ? "Action queued locally (placeholder execution)."
          : "Action dismissed locally.",
      );
    },
    [],
  );

  return {
    command,
    connected,
    isSessionPending,
    isSyncing,
    syncError,
    notice,
    lastSyncedAt,
    visibleItems,
    setCommand,
    runSync,
    connectGoogle,
    disconnectGoogle,
    markAction,
  };
}
