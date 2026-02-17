import type {
  ApproveActionRequest,
  ApproveActionResponse,
  DismissActionRequest,
  DismissActionResponse,
  FeedbackActionRequest,
  FeedbackActionResponse,
  QueueFeedbackRating,
  WorkflowApiErrorResponse,
} from "@nyte/workflows";

function isWorkflowApiErrorResponse(payload: unknown): payload is WorkflowApiErrorResponse {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const error = (payload as { error?: unknown }).error;
  return typeof error === "string" && error.trim().length > 0;
}

function resolveApiError(payload: unknown, fallback: string) {
  if (isWorkflowApiErrorResponse(payload)) {
    return payload.error;
  }

  return fallback;
}

async function readJson<TPayload>(response: Response): Promise<TPayload> {
  return (await response.json()) as TPayload;
}

export async function approveNeedsYouAction(itemId: string): Promise<ApproveActionResponse> {
  const body: ApproveActionRequest = { itemId };
  const response = await fetch("/api/actions/approve", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await readJson<unknown>(response);
  if (!response.ok) {
    throw new Error(resolveApiError(payload, "Unable to approve action."));
  }

  return payload as ApproveActionResponse;
}

export async function dismissNeedsYouAction(itemId: string): Promise<DismissActionResponse> {
  const body: DismissActionRequest = { itemId };
  const response = await fetch("/api/actions/dismiss", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await readJson<unknown>(response);
  if (!response.ok) {
    throw new Error(resolveApiError(payload, "Unable to dismiss action."));
  }

  return payload as DismissActionResponse;
}

export async function recordNeedsYouFeedback(
  itemId: string,
  rating: QueueFeedbackRating,
  note?: string,
): Promise<FeedbackActionResponse> {
  const body: FeedbackActionRequest = { itemId, rating, note };
  const response = await fetch("/api/actions/feedback", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await readJson<unknown>(response);
  if (!response.ok) {
    throw new Error(resolveApiError(payload, "Unable to save feedback."));
  }

  return payload as FeedbackActionResponse;
}
