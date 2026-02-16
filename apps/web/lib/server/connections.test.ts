import { beforeEach, describe, expect, it } from "vitest";
import {
  auditLogs,
  calendarEvents,
  connectedAccounts,
  db,
  ensureDbSchema,
  feedbackEntries,
  gateEvaluations,
  gmailDrafts,
  policyRules,
  proposedActions,
  users,
  workflowEvents,
  workflowRuns,
  workItems,
} from "@workspace/db";

import { decryptSecret } from "./token-crypto";
import {
  disconnectGoogleConnection,
  getGoogleConnectionStatus,
  rotateGoogleConnectionSecrets,
  upsertGoogleConnection,
} from "./connections";

async function resetDb() {
  await ensureDbSchema();
  await db.delete(calendarEvents);
  await db.delete(gmailDrafts);
  await db.delete(feedbackEntries);
  await db.delete(workflowEvents);
  await db.delete(workflowRuns);
  await db.delete(auditLogs);
  await db.delete(proposedActions);
  await db.delete(gateEvaluations);
  await db.delete(policyRules);
  await db.delete(workItems);
  await db.delete(connectedAccounts);
  await db.delete(users);
}

describe("google connection persistence", () => {
  beforeEach(async () => {
    await resetDb();
    process.env.NYTE_TOKEN_ENCRYPTION_KEY = "connections-test-key";
    delete process.env.NYTE_TOKEN_ENCRYPTION_KEY_PREVIOUS;
  });

  it("stores encrypted tokens and exposes connection status without secrets", async () => {
    const status = await upsertGoogleConnection(
      {
        providerAccountId: "acct_123",
        accessToken: "plain-access-token",
        refreshToken: "plain-refresh-token",
        scopes: [
          "https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/calendar.events",
        ],
      },
      new Date("2026-01-20T12:00:00.000Z"),
    );

    expect(status.connected).toBe(true);
    expect(status.providerAccountId).toBe("acct_123");

    const rows = await db.select().from(connectedAccounts);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.accessToken).not.toBe("plain-access-token");
    expect(rows[0]?.refreshToken).not.toBe("plain-refresh-token");
    expect(decryptSecret(rows[0]!.accessToken)).toBe("plain-access-token");
    expect(decryptSecret(rows[0]!.refreshToken ?? "")).toBe("plain-refresh-token");
  });

  it("removes persisted status on disconnect", async () => {
    await upsertGoogleConnection({}, new Date("2026-01-20T12:00:00.000Z"));
    const connected = await getGoogleConnectionStatus();
    expect(connected.connected).toBe(true);

    const disconnected = await disconnectGoogleConnection();
    expect(disconnected.connected).toBe(false);
  });

  it("re-encrypts stored tokens when encryption key rotates", async () => {
    await upsertGoogleConnection(
      {
        providerAccountId: "acct_rotate",
        accessToken: "access-before-rotation",
        refreshToken: "refresh-before-rotation",
      },
      new Date("2026-01-20T12:00:00.000Z"),
    );

    const beforeRows = await db.select().from(connectedAccounts);
    const beforeAccessToken = beforeRows[0]?.accessToken;
    const beforeRefreshToken = beforeRows[0]?.refreshToken;
    expect(beforeAccessToken).toBeDefined();
    expect(beforeRefreshToken).toBeDefined();

    process.env.NYTE_TOKEN_ENCRYPTION_KEY = "connections-rotated-key";
    process.env.NYTE_TOKEN_ENCRYPTION_KEY_PREVIOUS = "connections-test-key";
    const rotationResult = await rotateGoogleConnectionSecrets(
      new Date("2026-01-20T12:05:00.000Z"),
    );
    expect(rotationResult.rotated).toBe(true);

    const afterRows = await db.select().from(connectedAccounts);
    expect(afterRows[0]?.accessToken).not.toBe(beforeAccessToken);
    expect(afterRows[0]?.refreshToken).not.toBe(beforeRefreshToken);

    delete process.env.NYTE_TOKEN_ENCRYPTION_KEY_PREVIOUS;
    expect(decryptSecret(afterRows[0]!.accessToken)).toBe("access-before-rotation");
    expect(decryptSecret(afterRows[0]!.refreshToken ?? "")).toBe("refresh-before-rotation");
  });

  it("returns non-rotated response when connection is missing", async () => {
    const result = await rotateGoogleConnectionSecrets(new Date("2026-01-20T12:05:00.000Z"));
    expect(result.rotated).toBe(false);
    expect(result.status.connected).toBe(false);
  });
});
