import { Data } from "effect";

export class WorkflowTaskExecutionError extends Data.TaggedError("WorkflowTaskExecutionError")<{
  taskId: string;
  stage: "local" | "trigger";
  message: string;
  cause: unknown;
}> {}

export class WorkflowTaskResultError extends Data.TaggedError("WorkflowTaskResultError")<{
  taskId: string;
  stage: "trigger";
  message: string;
  cause: unknown;
}> {}

export type WorkflowTaskStage = WorkflowTaskExecutionError["stage"];
export type WorkflowTaskError = WorkflowTaskExecutionError | WorkflowTaskResultError;
