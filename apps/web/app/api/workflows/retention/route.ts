import {
  getWorkflowRetentionDays,
  setWorkflowRetentionDays,
  WorkflowRetentionError,
} from "@/lib/server/workflow-retention";
import { enforceRateLimit, RateLimitError } from "@/lib/server/rate-limit";

type RetentionBody = {
  days?: number;
};

export async function GET() {
  const retention = await getWorkflowRetentionDays();
  return Response.json(retention);
}

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "workflows:retention:update", {
      limit: 20,
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

  const body = (await request.json()) as RetentionBody;
  if (typeof body.days !== "number") {
    return Response.json({ error: "days is required." }, { status: 400 });
  }

  try {
    const retention = await setWorkflowRetentionDays(body.days, new Date());
    return Response.json(retention);
  } catch (error) {
    if (error instanceof WorkflowRetentionError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ error: "Failed to update retention policy." }, { status: 500 });
  }
}
