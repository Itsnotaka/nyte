import { Data } from "effect";

import type { WorkflowTaskId } from "./task-ids";

export type WorkflowTaskStage = "local" | "trigger";

export type WorkflowTaskExecutionError = Data.TaggedEnum<{
  WorkflowTaskExecutionError: {
    taskId: WorkflowTaskId;
    stage: WorkflowTaskStage;
    message: string;
    cause: unknown;
  };
}>;

export type WorkflowTaskResultError = Data.TaggedEnum<{
  WorkflowTaskResultError: {
    taskId: WorkflowTaskId;
    stage: "trigger";
    message: string;
    cause: unknown;
  };
}>;

const WorkflowTaskExecutionErrors = Data.taggedEnum<WorkflowTaskExecutionError>();
const WorkflowTaskResultErrors = Data.taggedEnum<WorkflowTaskResultError>();

export function createWorkflowTaskExecutionError(input: {
  taskId: WorkflowTaskId;
  stage: WorkflowTaskStage;
  message: string;
  cause: unknown;
}): WorkflowTaskExecutionError {
  return WorkflowTaskExecutionErrors.WorkflowTaskExecutionError(input);
}

export function createWorkflowTaskResultError(input: {
  taskId: WorkflowTaskId;
  stage: "trigger";
  message: string;
  cause: unknown;
}): WorkflowTaskResultError {
  return WorkflowTaskResultErrors.WorkflowTaskResultError(input);
}

export function isWorkflowTaskExecutionError(
  error: unknown
): error is WorkflowTaskExecutionError {
  return WorkflowTaskExecutionErrors.$is("WorkflowTaskExecutionError")(error);
}

export function isWorkflowTaskResultError(
  error: unknown
): error is WorkflowTaskResultError {
  return WorkflowTaskResultErrors.$is("WorkflowTaskResultError")(error);
}

export type WorkflowTaskError =
  | WorkflowTaskExecutionError
  | WorkflowTaskResultError;

export function isWorkflowTaskError(error: unknown): error is WorkflowTaskError {
  return isWorkflowTaskExecutionError(error) || isWorkflowTaskResultError(error);
}
