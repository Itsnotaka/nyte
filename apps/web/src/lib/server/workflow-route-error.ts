import {
  WorkflowTaskExecutionError,
  WorkflowTaskResultError,
  type WorkflowApiErrorResponse,
} from "@nyte/workflows";

type WorkflowRouteErrorResolution = {
  status: number;
  response: WorkflowApiErrorResponse;
  logData: {
    message: string;
    taskId?: string;
    errorTag?: string;
  };
};

export function resolveWorkflowRouteError(
  error: unknown,
  fallbackMessage: string,
): WorkflowRouteErrorResolution {
  if (error instanceof WorkflowTaskExecutionError || error instanceof WorkflowTaskResultError) {
    return {
      status: 502,
      response: {
        error: error.message,
      },
      logData: {
        message: error.message,
        taskId: error.taskId,
        errorTag: error._tag,
      },
    };
  }

  const message =
    error instanceof Error && error.message.trim().length > 0 ? error.message : fallbackMessage;

  return {
    status: 502,
    response: {
      error: message,
    },
    logData: {
      message,
    },
  };
}
