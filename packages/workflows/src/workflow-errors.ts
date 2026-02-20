import type { WorkflowTaskId } from "./task-ids";

type WorkflowTaskExecutionErrorInput = {
  taskId: WorkflowTaskId;
  message: string;
  cause: unknown;
};

export class WorkflowTaskExecutionError extends Error {
  readonly taskId: WorkflowTaskId;
  readonly workflowCause: unknown;

  constructor({ taskId, message, cause }: WorkflowTaskExecutionErrorInput) {
    super(message);
    this.name = "WorkflowTaskExecutionError";
    this.taskId = taskId;
    this.workflowCause = cause;
  }
}

export function createWorkflowTaskExecutionError(input: {
  taskId: WorkflowTaskId;
  message: string;
  cause: unknown;
}): WorkflowTaskExecutionError {
  return new WorkflowTaskExecutionError(input);
}

export function isWorkflowTaskExecutionError(
  error: unknown
): error is WorkflowTaskExecutionError {
  return error instanceof WorkflowTaskExecutionError;
}

export type WorkflowTaskError = WorkflowTaskExecutionError;

export function isWorkflowTaskError(
  error: unknown
): error is WorkflowTaskError {
  return isWorkflowTaskExecutionError(error);
}
