import { AuthorizationError, requireAuthorizedSession } from "@/lib/server/authz";
import { listAuditLogs, listAuditLogsByTarget } from "@/lib/server/audit-log";
import { enforceRateLimit, RateLimitError } from "@/lib/server/rate-limit";
import { createRateLimitResponse } from "@/lib/server/rate-limit-response";

export async function GET(request: Request) {
  try {
    await requireAuthorizedSession(request);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
  }

  try {
    enforceRateLimit(request, "admin:audit:read", {
      limit: 60,
      windowMs: 60_000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return createRateLimitResponse(error);
    }
  }

  const url = new URL(request.url);
  const targetType = url.searchParams.get("targetType");
  const targetId = url.searchParams.get("targetId");
  if ((targetType && !targetId) || (!targetType && targetId)) {
    return Response.json(
      { error: "targetType and targetId must be provided together." },
      { status: 400 },
    );
  }

  const limit = Number(url.searchParams.get("limit") ?? "100");
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 500) : 100;

  const rows =
    targetType && targetId
      ? await listAuditLogsByTarget(targetType, targetId, safeLimit)
      : await listAuditLogs(safeLimit);

  return Response.json({
    count: rows.length,
    rows,
  });
}
