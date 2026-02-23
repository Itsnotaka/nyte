import { v } from "convex/values";

import { query, type MutationCtx } from "./_generated/server";
import { requireAuthUserId } from "./lib/auth";

function parseAuditPayload(payloadJson: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(payloadJson);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return {
      parseError: true,
      rawPayload: payloadJson,
    };
  }
}

export type AuditLogInput = {
  userId?: string;
  action: string;
  targetType: string;
  targetId: string;
  payload: Record<string, unknown>;
  now?: number;
};

export async function recordAuditLog(
  ctx: MutationCtx,
  {
    userId,
    action,
    targetType,
    targetId,
    payload,
    now = Date.now(),
  }: AuditLogInput
): Promise<void> {
  await ctx.db.insert("auditLogs", {
    userId,
    action,
    targetType,
    targetId,
    payloadJson: JSON.stringify(payload),
    createdAt: now,
  });
}

export const listMine = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const limit = Math.max(1, Math.min(args.limit ?? 100, 500));
    const rows = await ctx.db
      .query("auditLogs")
      .withIndex("by_user_created_at", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return rows.map((row) => ({
      id: row._id,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      payload: parseAuditPayload(row.payloadJson),
      createdAt: row.createdAt,
    }));
  },
});
