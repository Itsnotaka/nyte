import { randomUUID } from "node:crypto";
import { and, count, desc, eq } from "drizzle-orm";
import { auditLogs, db, ensureDbSchema } from "@workspace/db";
import { Result } from "neverthrow";

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

function toIso(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "number") {
    return new Date(value).toISOString();
  }

  return new Date().toISOString();
}

function safeParsePayload(payloadJson: string): Record<string, unknown> {
  const parsedPayload = Result.fromThrowable(JSON.parse, () => null)(payloadJson);
  if (parsedPayload.isErr()) {
    return {
      parseError: true,
      rawPayload: payloadJson,
    };
  }
  const parsed = parsedPayload.value as unknown;
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }

  return {
    value: parsed,
  };
}

export async function listAuditLogs(limit = 100, offset = 0): Promise<AuditLogEntry[]> {
  await ensureDbSchema();

  const rows = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map(toAuditLogEntry);
}

export async function countAuditLogs() {
  await ensureDbSchema();
  const rows = await db.select({ total: count() }).from(auditLogs);
  const total = rows[0]?.total ?? 0;
  return Number(total);
}

export async function listAuditLogsByTarget(
  targetType: string,
  targetId: string,
  limit = 100,
  offset = 0,
) {
  await ensureDbSchema();
  const rows = await db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.targetType, targetType), eq(auditLogs.targetId, targetId)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map(toAuditLogEntry);
}

export async function countAuditLogsByTarget(targetType: string, targetId: string) {
  await ensureDbSchema();
  const rows = await db
    .select({ total: count() })
    .from(auditLogs)
    .where(and(eq(auditLogs.targetType, targetType), eq(auditLogs.targetId, targetId)));
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
    payload: safeParsePayload(row.payloadJson),
    createdAt: toIso(row.createdAt),
  };
}
