import { randomUUID } from "node:crypto";
import { connectedAccounts, db, ensureDbSchema } from "@nyte/db";
import { eq } from "@nyte/db/drizzle";

import { recordAuditLog } from "../audit/audit-log";
import { DEFAULT_USER_ID, ensureDefaultUser } from "../shared/default-user";
import { toIsoStringOrNull } from "../shared/time";
import { decryptSecret, encryptSecret } from "../security/token-crypto";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar.events",
] as const;

export type GoogleConnectionStatus = {
  connected: boolean;
  provider: "google";
  providerAccountId: string | null;
  scopes: string[];
  connectedAt: string | null;
  updatedAt: string | null;
};

export async function getGoogleConnectionStatus(): Promise<GoogleConnectionStatus> {
  await ensureDbSchema();
  const rows = await db
    .select()
    .from(connectedAccounts)
    .where(eq(connectedAccounts.id, "connection:google"))
    .limit(1);

  const row = rows.at(0);
  if (!row) {
    return {
      connected: false,
      provider: "google",
      providerAccountId: null,
      scopes: [],
      connectedAt: null,
      updatedAt: null,
    };
  }

  return {
    connected: true,
    provider: "google",
    providerAccountId: row.providerAccountId,
    scopes: row.scopes.split(" ").filter(Boolean),
    connectedAt: toIsoStringOrNull(row.connectedAt),
    updatedAt: toIsoStringOrNull(row.updatedAt),
  };
}

type UpsertGoogleConnectionInput = {
  providerAccountId?: string;
  accessToken?: string;
  refreshToken?: string;
  scopes?: string[];
};

export async function upsertGoogleConnection(
  {
    providerAccountId = `google-${randomUUID()}`,
    accessToken = `access-${randomUUID()}`,
    refreshToken = `refresh-${randomUUID()}`,
    scopes = [...GOOGLE_SCOPES],
  }: UpsertGoogleConnectionInput = {},
  now = new Date(),
) {
  await ensureDbSchema();
  await ensureDefaultUser(now);

  await db
    .insert(connectedAccounts)
    .values({
      id: "connection:google",
      userId: DEFAULT_USER_ID,
      provider: "google",
      providerAccountId,
      scopes: scopes.join(" "),
      accessToken: encryptSecret(accessToken),
      refreshToken: encryptSecret(refreshToken),
      connectedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: connectedAccounts.id,
      set: {
        providerAccountId,
        scopes: scopes.join(" "),
        accessToken: encryptSecret(accessToken),
        refreshToken: encryptSecret(refreshToken),
        updatedAt: now,
      },
    });

  await recordAuditLog({
    userId: DEFAULT_USER_ID,
    action: "connection.google.upserted",
    targetType: "connection",
    targetId: "google",
    payload: {
      providerAccountId,
      scopeCount: scopes.length,
    },
    now,
  });

  return getGoogleConnectionStatus();
}

export async function disconnectGoogleConnection() {
  await ensureDbSchema();
  await db.delete(connectedAccounts).where(eq(connectedAccounts.id, "connection:google"));
  await recordAuditLog({
    userId: DEFAULT_USER_ID,
    action: "connection.google.disconnected",
    targetType: "connection",
    targetId: "google",
    payload: {},
  });
  return getGoogleConnectionStatus();
}

export async function rotateGoogleConnectionSecrets(now = new Date()) {
  await ensureDbSchema();
  const rows = await db
    .select()
    .from(connectedAccounts)
    .where(eq(connectedAccounts.id, "connection:google"))
    .limit(1);
  const row = rows.at(0);
  if (!row) {
    await recordAuditLog({
      userId: DEFAULT_USER_ID,
      action: "connection.google.rotate-skipped",
      targetType: "connection",
      targetId: "google",
      payload: {
        reason: "not_connected",
      },
      now,
    });
    return {
      rotated: false as const,
      status: await getGoogleConnectionStatus(),
    };
  }

  const accessToken = decryptSecret(row.accessToken);
  const refreshToken = row.refreshToken ? decryptSecret(row.refreshToken) : null;

  await db
    .update(connectedAccounts)
    .set({
      accessToken: encryptSecret(accessToken),
      refreshToken: refreshToken ? encryptSecret(refreshToken) : null,
      updatedAt: now,
    })
    .where(eq(connectedAccounts.id, row.id));

  await recordAuditLog({
    userId: DEFAULT_USER_ID,
    action: "connection.google.rotated",
    targetType: "connection",
    targetId: "google",
    payload: {},
    now,
  });

  return {
    rotated: true as const,
    status: await getGoogleConnectionStatus(),
  };
}
