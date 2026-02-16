import { desc, eq } from "drizzle-orm";
import { auditLogs, db, ensureDbSchema } from "@workspace/db";

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
    id: `${targetType}:${targetId}:${action}:${now.getTime()}`,
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

export async function listAuditLogs(limit = 100): Promise<AuditLogEntry[]> {
  await ensureDbSchema();

  const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    payload: JSON.parse(row.payloadJson) as Record<string, unknown>,
    createdAt: toIso(row.createdAt),
  }));
}

export async function listAuditLogsByTarget(targetType: string, targetId: string, limit = 100) {
  await ensureDbSchema();
  const rows = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.targetType, targetType))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  return rows
    .filter((row) => row.targetId === targetId)
    .map((row) => ({
      id: row.id,
      userId: row.userId,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      payload: JSON.parse(row.payloadJson) as Record<string, unknown>,
      createdAt: toIso(row.createdAt),
    }));
}
