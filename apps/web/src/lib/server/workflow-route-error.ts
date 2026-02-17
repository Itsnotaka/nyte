import {
  WorkflowTaskExecutionError,
  type WorkflowTaskId,
  WorkflowTaskResultError,
  type WorkflowApiErrorResponse,
  type WorkflowTaskStage,
} from "@nyte/workflows";

type WorkflowRouteErrorResolution = {
  status: number;
  response: WorkflowApiErrorResponse;
  logData: {
    message: string;
    taskId?: WorkflowTaskId;
    errorTag?: string;
    stage?: WorkflowTaskStage;
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
        stage: error.stage,
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

export function resolveWorkflowDomainStatus(message: string): 404 | 409 {
  return message.toLowerCase().includes("not found") ? 404 : 409;
}

export function toWorkflowApiErrorResponse(error: string): WorkflowApiErrorResponse {
  return { error };
}
