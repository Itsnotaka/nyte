import { ApprovalError } from "@nyte/application/actions";
import { approveActionTask } from "@nyte/workflows";

import { auth } from "~/lib/auth";

type ApproveActionBody = {
  itemId?: unknown;
  idempotencyKey?: unknown;
};

function parseApproveBody(value: unknown): { itemId: string; idempotencyKey?: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const body = value as ApproveActionBody;
  if (typeof body.itemId !== "string" || body.itemId.trim().length === 0) {
    return null;
  }

  if (body.idempotencyKey === undefined) {
    return {
      itemId: body.itemId.trim(),
    };
  }

  if (typeof body.idempotencyKey !== "string" || body.idempotencyKey.trim().length === 0) {
    return null;
  }

  return {
    itemId: body.itemId.trim(),
    idempotencyKey: body.idempotencyKey.trim(),
  };
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  if (!session) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const payload = parseApproveBody(await request.json());
  if (!payload) {
    return Response.json({ error: "Invalid approval payload." }, { status: 400 });
  }

  try {
    const result = await approveActionTask({
      itemId: payload.itemId,
      idempotencyKey: payload.idempotencyKey,
      now: new Date(),
    });
    return Response.json({
      itemId: result.itemId,
      idempotent: result.idempotent,
      execution: result.execution,
    });
  } catch (error) {
    if (error instanceof ApprovalError) {
      const status = error.message.toLowerCase().includes("not found") ? 404 : 409;
      return Response.json({ error: error.message }, { status });
    }

    return Response.json({ error: "Unable to approve action." }, { status: 502 });
  }
}
