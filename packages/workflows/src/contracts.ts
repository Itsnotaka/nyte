import type { approveActionTask } from "./tasks/approve-action-task";
import type { dismissActionTask } from "./tasks/dismiss-action-task";
import type { feedbackTask } from "./tasks/feedback-task";
import type { ingestSignalsTask } from "./tasks/ingest-signals-task";

type TaskInput<TTask extends (...args: never[]) => unknown> = Parameters<TTask>[0];
type TaskOutput<TTask extends (...args: never[]) => unknown> = Awaited<ReturnType<TTask>>;

export type QueueSyncRequest = Omit<TaskInput<typeof ingestSignalsTask>, "accessToken" | "now">;
export type QueueSyncResponse = Pick<TaskOutput<typeof ingestSignalsTask>, "cursor" | "needsYou">;

export type ApproveActionRequest = Omit<TaskInput<typeof approveActionTask>, "now" | "actorUserId">;
export type ApproveActionResponse = TaskOutput<typeof approveActionTask>;

export type DismissActionRequest = Omit<TaskInput<typeof dismissActionTask>, "now">;
export type DismissActionResponse = TaskOutput<typeof dismissActionTask>;

export type FeedbackActionRequest = Omit<TaskInput<typeof feedbackTask>, "now">;
export type FeedbackActionResponse = TaskOutput<typeof feedbackTask>;

export type WorkflowApiErrorResponse = {
  error: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function isWorkflowApiErrorResponse(value: unknown): value is WorkflowApiErrorResponse {
  const payload = asRecord(value);
  if (!payload) {
    return false;
  }

  const error = payload.error;
  return typeof error === "string" && error.trim().length > 0;
}

export function isQueueSyncResponse(value: unknown): value is QueueSyncResponse {
  const payload = asRecord(value);
  if (!payload) {
    return false;
  }

  return (
    Array.isArray(payload.needsYou) &&
    typeof payload.cursor === "string" &&
    payload.cursor.trim().length > 0
  );
}
