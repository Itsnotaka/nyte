import { randomUUID } from "node:crypto";

import { db } from "@nyte/db/client";
import { auditLogs } from "@nyte/db/schema";
import { and, count, desc, eq, lt, or } from "drizzle-orm";
import { Effect } from "effect";

import { requireUserId } from "../identity/user-id";

type AuditExecutor = Pick<typeof db, "insert">;

function toIsoString(value: Date): string {
  const timestamp = value.getTime();
  if (Number.isNaN(timestamp)) {
    throw new TypeError("Invalid date value.");
  }

  return value.toISOString();
}

function parseRecordPayload(payloadJson: string): Record<string, unknown> {
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
  userId: string;
  action: string;
  targetType: string;
  targetId: string;
  payload: Record<string, unknown>;
  now?: Date;
  executor?: AuditExecutor;
};

export async function recordAuditLog({
  userId,
  action,
  targetType,
  targetId,
  payload,
  now = new Date(),
  executor = db,
}: AuditLogInput) {
  const normalizedUserId = requireUserId(userId);

  await executor.insert(auditLogs).values({
    id: `${targetType}:${targetId}:${action}:${now.getTime()}:${randomUUID()}`,
    userId: normalizedUserId,
    action,
    targetType,
    targetId,
    payloadJson: JSON.stringify(payload),
    createdAt: now,
  });
}

export const recordAuditLogProgram = (input: AuditLogInput) =>
  Effect.tryPromise(() => recordAuditLog(input));

export type AuditLogEntry = {
  id: string;
  userId: string;
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

export const listAuditLogsProgram = (limit = 100, offset = 0) =>
  Effect.tryPromise(() => listAuditLogs(limit, offset));

export async function countAuditLogs() {
  const rows = await db.select({ total: count() }).from(auditLogs);
  const total = rows[0]?.total ?? 0;
  return Number(total);
}

export const countAuditLogsProgram = () =>
  Effect.tryPromise(() => countAuditLogs());

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

export const listAuditLogsByTargetProgram = (
  targetType: string,
  targetId: string,
  limit = 100,
  offset = 0
) =>
  Effect.tryPromise(() =>
    listAuditLogsByTarget(targetType, targetId, limit, offset)
  );

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

export const countAuditLogsByTargetProgram = (
  targetType: string,
  targetId: string
) => Effect.tryPromise(() => countAuditLogsByTarget(targetType, targetId));

export type AuditLogCursor = {
  createdAt: string;
  id: string;
};

export async function listAuditLogsByCursor({
  limit = 100,
  cursor,
}: {
  limit?: number;
  cursor?: AuditLogCursor;
}): Promise<AuditLogEntry[]> {
  const rows =
    cursor === undefined
      ? await db
          .select()
          .from(auditLogs)
          .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
          .limit(limit)
      : await db
          .select()
          .from(auditLogs)
          .where(
            or(
              lt(auditLogs.createdAt, new Date(cursor.createdAt)),
              and(
                eq(auditLogs.createdAt, new Date(cursor.createdAt)),
                lt(auditLogs.id, cursor.id)
              )
            )
          )
          .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
          .limit(limit);

  return rows.map(toAuditLogEntry);
}

export async function pruneAuditLogs({ olderThan }: { olderThan: Date }) {
  if (Number.isNaN(olderThan.getTime())) {
    throw new TypeError("Invalid date value.");
  }

  return db.delete(auditLogs).where(lt(auditLogs.createdAt, olderThan));
}

function toAuditLogEntry(row: typeof auditLogs.$inferSelect): AuditLogEntry {
  return {
    id: row.id,
    userId: requireUserId(row.userId),
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    payload: parseRecordPayload(row.payloadJson),
    createdAt: toIsoString(row.createdAt),
  };
}
