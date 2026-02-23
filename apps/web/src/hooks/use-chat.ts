"use client";

import type { ToolCallPayload, WorkItemWithAction } from "@nyte/domain/actions";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { authClient } from "~/lib/auth-client";
import { GOOGLE_AUTH_PROVIDER } from "~/lib/auth-provider";
import { api } from "~/lib/convex";

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
  const [mutationError, setMutationError] = React.useState<string | null>(null);

  // Optimistic dismissal — items hidden immediately on action, cleared when server confirms.
  // Pattern from pi-mono: agent.appendMessage() fires before server round-trip completes.
  const [actedIds, setActedIds] = React.useState<Set<string>>(new Set());
  const [actingIds, setActingIds] = React.useState<Set<string>>(new Set());

  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const userId = session?.user?.id?.trim() ?? "";
  const connected = userId.length > 0;
  const feed = useQuery(
    api.queue.feed,
    connected ? { includeAll: true } : "skip"
  );
  const approveMutation = useMutation(api.actions.approve);
  const dismissMutation = useMutation(api.actions.dismiss);
  const isLoading = connected && feed === undefined;

  // Clear optimistic state when server data refreshes.
  // Same principle as pi-mono agent_end clearing streaming state.
  React.useEffect(() => {
    setActedIds(new Set());
  }, [feed?.approvalQueue.length]);

  const serverItems = connected ? (feed?.approvalQueue ?? []) : [];
  const items = serverItems.filter((item) => !actedIds.has(item.id));

  const error = React.useMemo(() => {
    if (mutationError) return mutationError;
    return null;
  }, [mutationError]);

  const refresh = React.useCallback(async () => {
    return Promise.resolve();
  }, []);

  const connectGoogle = React.useCallback(async () => {
    setMutationError(null);
    try {
      await authClient.signIn.social({
        provider: GOOGLE_AUTH_PROVIDER,
        callbackURL: "/",
      });
    } catch {
      setMutationError("Unable to connect Google right now.");
    }
  }, []);

  const disconnectGoogle = React.useCallback(async () => {
    setMutationError(null);
    try {
      await authClient.signOut();
      router.refresh();
    } catch {
      setMutationError("Unable to disconnect right now.");
    }
  }, [router]);

  const markAction = React.useCallback(
    async (
      item: WorkItemWithAction,
      status: ActionStatus,
      payloadOverride?: ToolCallPayload
    ) => {
      setMutationError(null);

      // Optimistically hide item before server round-trip.
      setActedIds((prev) => new Set([...prev, item.id]));
      setActingIds((prev) => new Set([...prev, item.id]));

      try {
        if (status === "approved") {
          await approveMutation({
            itemId: item.id,
            payloadOverride,
          });
        } else {
          await dismissMutation({ itemId: item.id });
        }
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
      } finally {
        setActingIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }
    },
    [approveMutation, dismissMutation]
  );

  return {
    connected,
    isSessionPending,
    isLoading,
    isActing: actingIds.size > 0,
    error,
    items,
    refresh,
    markAction,
    connectGoogle,
    disconnectGoogle,
  };
}
