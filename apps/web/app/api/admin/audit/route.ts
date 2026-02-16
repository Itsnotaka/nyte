import { AuthorizationError, requireAuthorizedSession } from "@/lib/server/authz";
import {
  countAuditLogs,
  countAuditLogsByTarget,
  listAuditLogs,
  listAuditLogsByTarget,
} from "@/lib/server/audit-log";
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
  const targetTypeParam = url.searchParams.get("targetType");
  const targetIdParam = url.searchParams.get("targetId");
  const targetType = targetTypeParam?.trim() ? targetTypeParam.trim() : null;
  const targetId = targetIdParam?.trim() ? targetIdParam.trim() : null;
  if ((targetType && !targetId) || (!targetType && targetId)) {
    return Response.json(
      { error: "targetType and targetId must be provided together." },
      { status: 400 },
    );
  }

  const limit = Number(url.searchParams.get("limit") ?? "100");
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 500) : 100;
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const safeOffset = Number.isFinite(offset) && offset >= 0 ? Math.floor(offset) : 0;

  const rows =
    targetType && targetId
      ? await listAuditLogsByTarget(targetType, targetId, safeLimit, safeOffset)
      : await listAuditLogs(safeLimit, safeOffset);
  const totalCount =
    targetType && targetId
      ? await countAuditLogsByTarget(targetType, targetId)
      : await countAuditLogs();

  return Response.json({
    count: rows.length,
    totalCount,
    hasMore: safeOffset + rows.length < totalCount,
    limit: safeLimit,
    offset: safeOffset,
    rows,
  });
}
