type ActionErrorPayload = {
  error?: unknown;
};

function resolveApiError(payload: ActionErrorPayload, fallback: string) {
  if (typeof payload.error === "string" && payload.error.trim().length > 0) {
    return payload.error;
  }

  return fallback;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

export async function approveNeedsYouAction(itemId: string) {
  const response = await fetch("/api/actions/approve", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ itemId }),
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(resolveApiError(payload, "Unable to approve action."));
  }
}

export async function dismissNeedsYouAction(itemId: string) {
  const response = await fetch("/api/actions/dismiss", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ itemId }),
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(resolveApiError(payload, "Unable to dismiss action."));
  }
}

export async function recordNeedsYouFeedback(
  itemId: string,
  rating: "positive" | "negative",
  note?: string,
) {
  const response = await fetch("/api/actions/feedback", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ itemId, rating, note }),
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(resolveApiError(payload, "Unable to save feedback."));
  }
}
