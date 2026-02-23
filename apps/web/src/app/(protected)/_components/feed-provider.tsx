"use client";

import { useMutation } from "convex/react";
import { createContext, use, useCallback, useMemo, useState } from "react";

import { api } from "~/lib/convex";

type FeedContextValue = {
  approve: (itemId: string) => Promise<void>;
  dismiss: (itemId: string) => Promise<void>;
  pendingIds: Set<string>;
  actionError: string | null;
  clearActionError: () => void;
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

export function FeedProvider({ children }: { children: React.ReactNode }) {
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  const approveMutation = useMutation(api.actions.approve);
  const dismissMutation = useMutation(api.actions.dismiss);

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

  const approve = useCallback(
    async (itemId: string) => {
      setActionError(null);
      updatePendingState(itemId, true);
      try {
        await approveMutation({ itemId });
      } catch (error) {
        setActionError(toErrorMessage(error, "Unable to approve this item."));
      } finally {
        updatePendingState(itemId, false);
      }
    },
    [approveMutation, updatePendingState]
  );

  const dismiss = useCallback(
    async (itemId: string) => {
      setActionError(null);
      updatePendingState(itemId, true);
      try {
        await dismissMutation({ itemId });
      } catch (error) {
        setActionError(toErrorMessage(error, "Unable to dismiss this item."));
      } finally {
        updatePendingState(itemId, false);
      }
    },
    [dismissMutation, updatePendingState]
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
