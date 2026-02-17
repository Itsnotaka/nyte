import { DismissError } from "@nyte/application/actions";
import { dismissActionTask } from "@nyte/workflows";

import { auth } from "~/lib/auth";

type DismissActionBody = {
  itemId?: unknown;
};

function parseDismissBody(value: unknown): { itemId: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const body = value as DismissActionBody;
  if (typeof body.itemId !== "string" || body.itemId.trim().length === 0) {
    return null;
  }

  return {
    itemId: body.itemId.trim(),
  };
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  if (!session) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const payload = parseDismissBody(await request.json());
  if (!payload) {
    return Response.json({ error: "Invalid dismissal payload." }, { status: 400 });
  }

  try {
    const result = await dismissActionTask({
      itemId: payload.itemId,
      now: new Date(),
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof DismissError) {
      const status = error.message.toLowerCase().includes("not found") ? 404 : 409;
      return Response.json({ error: error.message }, { status });
    }

    return Response.json({ error: "Unable to dismiss action." }, { status: 502 });
  }
}
