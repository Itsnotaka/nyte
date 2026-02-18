"use client";

import type { ToolCallPayload, WorkItemWithAction } from "@nyte/domain/actions";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";
import { z } from "zod";

import { authClient } from "~/lib/auth-client";
import { GOOGLE_AUTH_PROVIDER } from "~/lib/auth-provider";
import { QUEUE_MESSAGES, formatSyncFilteredNotice } from "~/lib/queue/messages";
import { useTRPC, useTRPCClient } from "~/lib/trpc";

const MIN_WATCH_KEYWORD_LENGTH = 3;
const MAX_WATCH_KEYWORD_LENGTH = 64;
const MAX_WATCH_KEYWORDS = 8;
const WATCH_COMMAND_PREFIX = "watch";
const WATCH_KEYWORD_SEPARATORS = new Set([" ", "\n", "\t", "\r", ","]);

const watchKeywordSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(MIN_WATCH_KEYWORD_LENGTH)
  .max(MAX_WATCH_KEYWORD_LENGTH);

const watchKeywordCommandSchema = z.string().trim().transform((command) => {
  const tokens: string[] = [];
  let currentToken = "";

  for (const character of command) {
    if (WATCH_KEYWORD_SEPARATORS.has(character)) {
      if (currentToken.length > 0) {
        tokens.push(currentToken);
        currentToken = "";
      }

      continue;
    }

    currentToken += character;
  }

  if (currentToken.length > 0) {
    tokens.push(currentToken);
  }

  const candidateKeywords =
    tokens[0]?.toLowerCase() === WATCH_COMMAND_PREFIX ? tokens.slice(1) : tokens;

  const keywords: string[] = [];
  const seenKeywords = new Set<string>();

  for (const candidate of candidateKeywords) {
    const keywordResult = watchKeywordSchema.safeParse(candidate);
    if (!keywordResult.success) {
      continue;
    }

    const keyword = keywordResult.data;
    if (keyword === WATCH_COMMAND_PREFIX || seenKeywords.has(keyword)) {
      continue;
    }

    seenKeywords.add(keyword);
    keywords.push(keyword);
    if (keywords.length >= MAX_WATCH_KEYWORDS) {
      break;
    }
  }

  return keywords;
});

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
      const keywords = watchKeywordCommandSchema.parse(command);

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
    setNotice(null);
    setMutationError(null);

    try {
      await authClient.signOut();
      setActiveWatchKeywords([]);
      queryClient.removeQueries({ queryKey: ["workspace.sync", userId] });
      router.refresh();
    } catch {
      setMutationError("Unable to disconnect Google right now.");
    }
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
