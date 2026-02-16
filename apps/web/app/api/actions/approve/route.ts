import { ApprovalError, approveWorkItem } from "@/lib/server/approve-action";
import { enforceRateLimit, RateLimitError } from "@/lib/server/rate-limit";

type ApproveBody = {
  itemId?: string;
  idempotencyKey?: string;
};

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "actions:approve", {
      limit: 30,
      windowMs: 60_000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json(
        {
          error: error.message,
          retryAfterSeconds: error.retryAfterSeconds,
        },
        { status: 429 },
      );
    }
  }

  const body = (await request.json()) as ApproveBody;
  if (!body.itemId) {
    return Response.json({ error: "itemId is required." }, { status: 400 });
  }
  const idempotencyKey = request.headers.get("x-idempotency-key") ?? body.idempotencyKey;

  try {
    const result = await approveWorkItem(body.itemId, new Date(), idempotencyKey ?? undefined);
    return Response.json(result);
  } catch (error) {
    if (error instanceof ApprovalError) {
      const status = error.message.includes("not found") ? 404 : 409;
      return Response.json({ error: error.message }, { status });
    }

    return Response.json({ error: "Failed to approve work item." }, { status: 500 });
  }
}
