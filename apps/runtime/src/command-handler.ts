import { ApprovalError, approveWorkItem } from "@nyte/application/approve-action";
import { dismissWorkItem, DismissError } from "@nyte/application/dismiss-action";
import { FeedbackError, recordFeedback } from "@nyte/application/feedback";
import { persistSignals } from "@nyte/application/queue-store";
import type { RuntimeCommand, RuntimeCommandResult, RuntimeErrorResult } from "@nyte/contracts";
import { pollGmailIngestion } from "@nyte/integrations/gmail/polling";
import { Result, ResultAsync } from "neverthrow";

export type RuntimeCommandHandlerDeps = {
  pollGmailIngestion: typeof pollGmailIngestion;
  persistSignals: typeof persistSignals;
  approveWorkItem: typeof approveWorkItem;
  dismissWorkItem: typeof dismissWorkItem;
  recordFeedback: typeof recordFeedback;
};

const DEFAULT_DEPS: RuntimeCommandHandlerDeps = {
  pollGmailIngestion,
  persistSignals,
  approveWorkItem,
  dismissWorkItem,
  recordFeedback,
};

function toIso(value: Date): string {
  return value.toISOString();
}

function toRuntimeError(
  requestId: string,
  code: RuntimeErrorResult["code"],
  message: string,
): RuntimeErrorResult {
  return {
    status: "error",
    requestId,
    code,
    message,
  };
}

function toKnownMutationError(error: unknown): {
  code: RuntimeErrorResult["code"];
  message: string;
} | null {
  if (
    !(
      error instanceof ApprovalError ||
      error instanceof DismissError ||
      error instanceof FeedbackError
    )
  ) {
    return null;
  }

  return {
    code: error.message.toLowerCase().includes("not found") ? "not_found" : "conflict",
    message: error.message,
  };
}

export function createRuntimeCommandHandler(deps: RuntimeCommandHandlerDeps = DEFAULT_DEPS) {
  return async function handleRuntimeCommand(
    command: RuntimeCommand,
    now = new Date(),
  ): Promise<RuntimeCommandResult> {
    const receivedAt = toIso(now);
    const requestId = command.context.requestId;

    if (command.type === "runtime.ingest") {
      const pollResult = Result.fromThrowable(
        () =>
          deps.pollGmailIngestion({
            cursor: command.payload.cursor,
            now,
            watchKeywords: command.payload.watchKeywords,
          }),
        () => new Error("Failed to ingest runtime command."),
      )();
      if (pollResult.isErr()) {
        return toRuntimeError(requestId, "internal", "Failed to ingest runtime command.");
      }

      const persistedSignals = await ResultAsync.fromPromise(
        deps.persistSignals(pollResult.value.signals, now),
        () => new Error("Failed to ingest runtime command."),
      );
      if (persistedSignals.isErr()) {
        return toRuntimeError(requestId, "internal", "Failed to ingest runtime command.");
      }

      return {
        status: "accepted",
        type: "runtime.ingest",
        requestId,
        receivedAt,
        result: {
          cursor: pollResult.value.nextCursor,
          queuedCount: persistedSignals.value.length,
        },
      };
    }

    if (command.type === "runtime.approve") {
      const approvalResult = await ResultAsync.fromPromise(
        deps.approveWorkItem(command.payload.itemId, now, command.payload.idempotencyKey),
        (error) => error,
      );
      if (approvalResult.isErr()) {
        const knownError = toKnownMutationError(approvalResult.error);
        if (knownError) {
          return toRuntimeError(requestId, knownError.code, knownError.message);
        }

        return toRuntimeError(requestId, "internal", "Failed to approve runtime command.");
      }

      return {
        status: "accepted",
        type: "runtime.approve",
        requestId,
        receivedAt,
        result: {
          itemId: approvalResult.value.itemId,
          idempotent: approvalResult.value.idempotent,
        },
      };
    }

    if (command.type === "runtime.dismiss") {
      const dismissResult = await ResultAsync.fromPromise(
        deps.dismissWorkItem(command.payload.itemId, now),
        (error) => error,
      );
      if (dismissResult.isErr()) {
        const knownError = toKnownMutationError(dismissResult.error);
        if (knownError) {
          return toRuntimeError(requestId, knownError.code, knownError.message);
        }

        return toRuntimeError(requestId, "internal", "Failed to dismiss runtime command.");
      }

      return {
        status: "accepted",
        type: "runtime.dismiss",
        requestId,
        receivedAt,
        result: {
          itemId: dismissResult.value.itemId,
        },
      };
    }

    const feedbackResult = await ResultAsync.fromPromise(
      deps.recordFeedback(
        command.payload.itemId,
        command.payload.rating,
        command.payload.note,
        now,
      ),
      (error) => error,
    );
    if (feedbackResult.isErr()) {
      const knownError = toKnownMutationError(feedbackResult.error);
      if (knownError) {
        return toRuntimeError(requestId, knownError.code, knownError.message);
      }

      return toRuntimeError(requestId, "internal", "Failed to record runtime feedback.");
    }

    return {
      status: "accepted",
      type: "runtime.feedback",
      requestId,
      receivedAt,
      result: {
        itemId: feedbackResult.value.itemId,
        rating: feedbackResult.value.rating,
      },
    };
  };
}

export const handleRuntimeCommand = createRuntimeCommandHandler();
