import { db } from "@nyte/db/client";
import { ingestionState } from "@nyte/db/schema";
import { eq } from "drizzle-orm";

import { requireUserId } from "../identity/user-id";

type IngestionStateExecutor = Pick<typeof db, "insert">;

function toIsoString(value: Date | null): string | null {
  if (value === null) {
    return null;
  }

  const timestamp = value.getTime();
  if (Number.isNaN(timestamp)) {
    throw new TypeError("Invalid date value.");
  }

  return value.toISOString();
}

export type UserIngestionState = {
  userId: string;
  gmailCursor: string | null;
  calendarCursor: string | null;
  lastSyncedAt: string | null;
  bootstrapCompletedAt: string | null;
  lastError: string | null;
  updatedAt: string;
};

export type UpsertUserIngestionStateInput = {
  userId: string;
  gmailCursor: string | null;
  calendarCursor: string | null;
  lastSyncedAt: Date | null;
  bootstrapCompletedAt: Date | null;
  lastError: string | null;
  now?: Date;
  executor?: IngestionStateExecutor;
};

export async function getUserIngestionState(
  userId: string
): Promise<UserIngestionState | null> {
  const normalizedUserId = requireUserId(userId);
  const rows = await db
    .select()
    .from(ingestionState)
    .where(eq(ingestionState.userId, normalizedUserId))
    .limit(1);
  const row = rows.at(0);
  if (!row) {
    return null;
  }

  return {
    userId: requireUserId(row.userId),
    gmailCursor: row.gmailCursor,
    calendarCursor: row.calendarCursor,
    lastSyncedAt: toIsoString(row.lastSyncedAt),
    bootstrapCompletedAt: toIsoString(row.bootstrapCompletedAt),
    lastError: row.lastError,
    updatedAt: toIsoString(row.updatedAt) ?? new Date().toISOString(),
  };
}

export async function upsertUserIngestionState({
  userId,
  gmailCursor,
  calendarCursor,
  lastSyncedAt,
  bootstrapCompletedAt,
  lastError,
  now = new Date(),
  executor = db,
}: UpsertUserIngestionStateInput) {
  const normalizedUserId = requireUserId(userId);

  await executor
    .insert(ingestionState)
    .values({
      userId: normalizedUserId,
      gmailCursor,
      calendarCursor,
      lastSyncedAt,
      bootstrapCompletedAt,
      lastError,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: ingestionState.userId,
      set: {
        gmailCursor,
        calendarCursor,
        lastSyncedAt,
        bootstrapCompletedAt,
        lastError,
        updatedAt: now,
      },
    });
}
