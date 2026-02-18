import type { WorkflowTaskId } from "./task-ids";

export type WorkflowTaskStage = "local" | "trigger";

type WorkflowTaskExecutionErrorInput = {
  taskId: WorkflowTaskId;
  stage: WorkflowTaskStage;
  message: string;
  cause: unknown;
};

type WorkflowTaskResultErrorInput = {
  taskId: WorkflowTaskId;
  stage: "trigger";
  message: string;
  cause: unknown;
};

export class WorkflowTaskExecutionError extends Error {
  readonly taskId: WorkflowTaskId;
  readonly stage: WorkflowTaskStage;
  readonly workflowCause: unknown;

  constructor({ taskId, stage, message, cause }: WorkflowTaskExecutionErrorInput) {
    super(message);
    this.name = "WorkflowTaskExecutionError";
    this.taskId = taskId;
    this.stage = stage;
    this.workflowCause = cause;
  }
}

export class WorkflowTaskResultError extends Error {
  readonly taskId: WorkflowTaskId;
  readonly stage: "trigger";
  readonly workflowCause: unknown;

  constructor({ taskId, stage, message, cause }: WorkflowTaskResultErrorInput) {
    super(message);
    this.name = "WorkflowTaskResultError";
    this.taskId = taskId;
    this.stage = stage;
    this.workflowCause = cause;
  }
}

export function createWorkflowTaskExecutionError(input: {
  taskId: WorkflowTaskId;
  stage: WorkflowTaskStage;
  message: string;
  cause: unknown;
}): WorkflowTaskExecutionError {
  return new WorkflowTaskExecutionError(input);
}

export function createWorkflowTaskResultError(input: {
  taskId: WorkflowTaskId;
  stage: "trigger";
  message: string;
  cause: unknown;
}): WorkflowTaskResultError {
  return new WorkflowTaskResultError(input);
}

export function isWorkflowTaskExecutionError(
  error: unknown
): error is WorkflowTaskExecutionError {
  return error instanceof WorkflowTaskExecutionError;
}

export function isWorkflowTaskResultError(
  error: unknown
): error is WorkflowTaskResultError {
  return error instanceof WorkflowTaskResultError;
}

export type WorkflowTaskError =
  | WorkflowTaskExecutionError
  | WorkflowTaskResultError;

export function isWorkflowTaskError(
  error: unknown
): error is WorkflowTaskError {
  return (
    isWorkflowTaskExecutionError(error) || isWorkflowTaskResultError(error)
  );
}
