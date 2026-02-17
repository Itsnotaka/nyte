import { randomUUID } from "node:crypto";

import { db } from "@nyte/db/client";
import { auditLogs } from "@nyte/db/schema";
import { and, count, desc, eq } from "drizzle-orm";

import { parseRecordPayload } from "../shared/payload";
import { toIsoString } from "../shared/time";

type AuditExecutor = Pick<typeof db, "insert">;

export type AuditLogInput = {
  userId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  payload: Record<string, unknown>;
  now?: Date;
  executor?: AuditExecutor;
};

export async function recordAuditLog({
  userId = null,
  action,
  targetType,
  targetId,
  payload,
  now = new Date(),
  executor = db,
}: AuditLogInput) {
  await executor.insert(auditLogs).values({
    id: `${targetType}:${targetId}:${action}:${now.getTime()}:${randomUUID()}`,
    userId,
    action,
    targetType,
    targetId,
    payloadJson: JSON.stringify(payload),
    createdAt: now,
  });
}

export type AuditLogEntry = {
  id: string;
  userId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export async function listAuditLogs(
  limit = 100,
  offset = 0
): Promise<AuditLogEntry[]> {
  const rows = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map(toAuditLogEntry);
}

export async function countAuditLogs() {
  const rows = await db.select({ total: count() }).from(auditLogs);
  const total = rows[0]?.total ?? 0;
  return Number(total);
}

export async function listAuditLogsByTarget(
  targetType: string,
  targetId: string,
  limit = 100,
  offset = 0
) {
  const rows = await db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.targetType, targetType),
        eq(auditLogs.targetId, targetId)
      )
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map(toAuditLogEntry);
}

export async function countAuditLogsByTarget(
  targetType: string,
  targetId: string
) {
  const rows = await db
    .select({ total: count() })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.targetType, targetType),
        eq(auditLogs.targetId, targetId)
      )
    );
  const total = rows[0]?.total ?? 0;
  return Number(total);
}

function toAuditLogEntry(row: typeof auditLogs.$inferSelect): AuditLogEntry {
  return {
    id: row.id,
    userId: row.userId,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    payload: parseRecordPayload(row.payloadJson),
    createdAt: toIsoString(row.createdAt),
  };
}
