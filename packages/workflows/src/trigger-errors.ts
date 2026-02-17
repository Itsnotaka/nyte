import { Data } from "effect";

import type { WorkflowTaskId } from "./task-ids";

export class WorkflowTaskExecutionError extends Data.TaggedError(
  "WorkflowTaskExecutionError"
)<{
  taskId: WorkflowTaskId;
  stage: "local" | "trigger";
  message: string;
  cause: unknown;
}> {}

export class WorkflowTaskResultError extends Data.TaggedError(
  "WorkflowTaskResultError"
)<{
  taskId: WorkflowTaskId;
  stage: "trigger";
  message: string;
  cause: unknown;
}> {}

export type WorkflowTaskStage = WorkflowTaskExecutionError["stage"];
export type WorkflowTaskError =
  | WorkflowTaskExecutionError
  | WorkflowTaskResultError;
