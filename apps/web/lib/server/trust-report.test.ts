import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
import { mockIntakeSignals } from "@workspace/domain/mock-intake";

import { approveWorkItem } from "./approve-action";
import { recordAuditLog } from "./audit-log";
import { upsertGoogleConnection } from "./connections";
import { addWatchKeyword } from "./policy-rules";
import { persistSignals } from "./queue-store";
import { getTrustReport } from "./trust-report";
import { setWorkflowRetentionDays } from "./workflow-retention";

const originalTokenKey = process.env.NYTE_TOKEN_ENCRYPTION_KEY;
const originalAuthSecret = process.env.BETTER_AUTH_SECRET;
const originalRequireAuth = process.env.NYTE_REQUIRE_AUTH;
const originalUnkeyRootKey = process.env.UNKEY_ROOT_KEY;
const originalRateLimitMode = process.env.NYTE_RATE_LIMIT_MODE;
const originalRuntimeAuthToken = process.env.NYTE_RUNTIME_AUTH_TOKEN;

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

describe("getTrustReport", () => {
  beforeEach(async () => {
    await resetDb();
    process.env.NYTE_TOKEN_ENCRYPTION_KEY = "trust-report-test-key";
    process.env.BETTER_AUTH_SECRET = "test-secret";
    process.env.NYTE_REQUIRE_AUTH = "true";
    process.env.UNKEY_ROOT_KEY = "trust-report-unkey-root-key";
    delete process.env.NYTE_RATE_LIMIT_MODE;
    delete process.env.NYTE_RUNTIME_AUTH_TOKEN;
  });

  afterEach(() => {
    if (originalTokenKey === undefined) {
      delete process.env.NYTE_TOKEN_ENCRYPTION_KEY;
    } else {
      process.env.NYTE_TOKEN_ENCRYPTION_KEY = originalTokenKey;
    }
    if (originalAuthSecret === undefined) {
      delete process.env.BETTER_AUTH_SECRET;
    } else {
      process.env.BETTER_AUTH_SECRET = originalAuthSecret;
    }
    if (originalRequireAuth === undefined) {
      delete process.env.NYTE_REQUIRE_AUTH;
    } else {
      process.env.NYTE_REQUIRE_AUTH = originalRequireAuth;
    }
    if (originalUnkeyRootKey === undefined) {
      delete process.env.UNKEY_ROOT_KEY;
    } else {
      process.env.UNKEY_ROOT_KEY = originalUnkeyRootKey;
    }
    if (originalRateLimitMode === undefined) {
      delete process.env.NYTE_RATE_LIMIT_MODE;
    } else {
      process.env.NYTE_RATE_LIMIT_MODE = originalRateLimitMode;
    }

    if (originalRuntimeAuthToken === undefined) {
      delete process.env.NYTE_RUNTIME_AUTH_TOKEN;
    } else {
      process.env.NYTE_RUNTIME_AUTH_TOKEN = originalRuntimeAuthToken;
    }
  });

  it("aggregates metrics, retention, watch rules, and connection status", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-01-20T12:00:00.000Z"));
    await approveWorkItem("w_renewal", new Date("2026-01-20T12:05:00.000Z"));
    await addWatchKeyword("renewal", new Date("2026-01-20T12:06:00.000Z"));
    await setWorkflowRetentionDays(14, new Date("2026-01-20T12:07:00.000Z"));
    await upsertGoogleConnection(
      {
        providerAccountId: "acct_trust",
      },
      new Date("2026-01-20T12:08:00.000Z"),
    );

    const report = await getTrustReport(new Date("2026-01-20T12:10:00.000Z"));

    expect(report.metrics.completedCount).toBe(1);
    expect(report.retention.days).toBe(14);
    expect(report.watchRuleCount).toBe(1);
    expect(report.watchRules).toContain("renewal");
    expect(report.googleConnection.connected).toBe(true);
    expect(report.googleConnection.providerAccountId).toBe("acct_trust");
    expect(report.security.authzEnforced).toBe(true);
    expect(report.security.authSecretConfigured).toBe(true);
    expect(report.security.authSecretSource).toBe("env");
    expect(report.security.tokenEncryptionKeyConfigured).toBe(true);
    expect(report.security.tokenEncryptionKeySource).toBe("env");
    expect(report.security.runtimeAuthTokenConfigured).toBe(false);
    expect(report.security.rateLimitMode).toBe("auto");
    expect(report.security.rateLimitProvider).toBe("unkey");
    expect(report.security.unkeyRateLimitConfigured).toBe(true);
    expect(report.security.unkeyRateLimitActive).toBe(true);
    expect(report.posture.status).toBe("ok");
    expect(report.posture.warnings).toHaveLength(0);
    expect(report.audit.recentCount).toBeGreaterThan(0);
    expect(report.audit.latestAction).not.toBeNull();
  });

  it("surfaces warning posture when Unkey root key is not configured", async () => {
    delete process.env.UNKEY_ROOT_KEY;

    const report = await getTrustReport(new Date("2026-01-20T12:10:00.000Z"));

    expect(report.security.rateLimitMode).toBe("auto");
    expect(report.security.rateLimitProvider).toBe("memory");
    expect(report.security.unkeyRateLimitConfigured).toBe(false);
    expect(report.security.unkeyRateLimitActive).toBe(false);
    expect(report.posture.status).toBe("warning");
    expect(report.posture.warnings).toContain(
      "UNKEY_ROOT_KEY is not configured; using in-process fallback rate limiter.",
    );
  });

  it("treats whitespace-only Unkey root key as not configured", async () => {
    process.env.UNKEY_ROOT_KEY = "   ";

    const report = await getTrustReport(new Date("2026-01-20T12:10:00.000Z"));

    expect(report.security.rateLimitMode).toBe("auto");
    expect(report.security.rateLimitProvider).toBe("memory");
    expect(report.security.unkeyRateLimitConfigured).toBe(false);
    expect(report.security.unkeyRateLimitActive).toBe(false);
  });

  it("reports explicit memory mode override when configured", async () => {
    process.env.UNKEY_ROOT_KEY = "trust-report-unkey-root-key";
    process.env.NYTE_RATE_LIMIT_MODE = "memory";

    const report = await getTrustReport(new Date("2026-01-20T12:10:00.000Z"));

    expect(report.security.rateLimitMode).toBe("memory");
    expect(report.security.rateLimitProvider).toBe("memory");
    expect(report.security.unkeyRateLimitConfigured).toBe(true);
    expect(report.security.unkeyRateLimitActive).toBe(false);
    expect(report.posture.warnings).toContain(
      "NYTE_RATE_LIMIT_MODE is set to memory; using in-process rate limiter.",
    );
  });

  it("reports explicit memory mode override without key as forced-memory posture", async () => {
    delete process.env.UNKEY_ROOT_KEY;
    process.env.NYTE_RATE_LIMIT_MODE = "memory";

    const report = await getTrustReport(new Date("2026-01-20T12:10:00.000Z"));

    expect(report.security.rateLimitMode).toBe("memory");
    expect(report.security.rateLimitProvider).toBe("memory");
    expect(report.security.unkeyRateLimitConfigured).toBe(false);
    expect(report.security.unkeyRateLimitActive).toBe(false);
    expect(report.posture.warnings).toContain(
      "NYTE_RATE_LIMIT_MODE is set to memory; using in-process rate limiter.",
    );
    expect(report.posture.warnings).not.toContain(
      "UNKEY_ROOT_KEY is not configured; using in-process fallback rate limiter.",
    );
  });

  it("reports forced unkey mode with memory fallback when key is missing", async () => {
    delete process.env.UNKEY_ROOT_KEY;
    process.env.NYTE_RATE_LIMIT_MODE = "unkey";

    const report = await getTrustReport(new Date("2026-01-20T12:10:00.000Z"));

    expect(report.security.rateLimitMode).toBe("unkey");
    expect(report.security.rateLimitProvider).toBe("memory");
    expect(report.security.unkeyRateLimitConfigured).toBe(false);
    expect(report.security.unkeyRateLimitActive).toBe(false);
    expect(report.posture.warnings).toContain(
      "NYTE_RATE_LIMIT_MODE is set to unkey but UNKEY_ROOT_KEY is not configured.",
    );
  });

  it("normalizes mode casing and whitespace in trust telemetry", async () => {
    process.env.UNKEY_ROOT_KEY = "trust-report-unkey-root-key";
    process.env.NYTE_RATE_LIMIT_MODE = "  MEMORY ";
    const memoryModeReport = await getTrustReport(new Date("2026-01-20T12:10:00.000Z"));

    expect(memoryModeReport.security.rateLimitMode).toBe("memory");
    expect(memoryModeReport.security.rateLimitProvider).toBe("memory");
    expect(memoryModeReport.security.unkeyRateLimitActive).toBe(false);

    process.env.NYTE_RATE_LIMIT_MODE = " UnKeY ";
    const unkeyModeReport = await getTrustReport(new Date("2026-01-20T12:10:00.000Z"));

    expect(unkeyModeReport.security.rateLimitMode).toBe("unkey");
    expect(unkeyModeReport.security.rateLimitProvider).toBe("unkey");
    expect(unkeyModeReport.security.unkeyRateLimitActive).toBe(true);
  });

  it("normalizes invalid mode values to auto in trust telemetry", async () => {
    process.env.UNKEY_ROOT_KEY = "trust-report-unkey-root-key";
    process.env.NYTE_RATE_LIMIT_MODE = "invalid-mode";
    const reportWithKey = await getTrustReport(new Date("2026-01-20T12:10:00.000Z"));

    expect(reportWithKey.security.rateLimitMode).toBe("auto");
    expect(reportWithKey.security.rateLimitProvider).toBe("unkey");
    expect(reportWithKey.security.unkeyRateLimitActive).toBe(true);

    delete process.env.UNKEY_ROOT_KEY;
    const reportWithoutKey = await getTrustReport(new Date("2026-01-20T12:10:00.000Z"));

    expect(reportWithoutKey.security.rateLimitMode).toBe("auto");
    expect(reportWithoutKey.security.rateLimitProvider).toBe("memory");
    expect(reportWithoutKey.security.unkeyRateLimitActive).toBe(false);
  });

  it("summarizes recent runtime delegation audit events", async () => {
    await recordAuditLog({
      action: "runtime.delegate.approve.accepted",
      targetType: "runtime_command",
      targetId: "req_accept_1",
      payload: {},
      now: new Date("2026-01-20T12:00:00.000Z"),
    });
    await recordAuditLog({
      action: "runtime.delegate.feedback.runtime_error",
      targetType: "runtime_command",
      targetId: "req_error_1",
      payload: {},
      now: new Date("2026-01-20T12:01:00.000Z"),
    });

    const report = await getTrustReport(new Date("2026-01-20T12:10:00.000Z"));

    expect(report.runtimeDelegation).toEqual({
      recentCount: 2,
      acceptedCount: 1,
      errorCount: 1,
      latestCommand: "feedback",
      latestOutcome: "runtime_error",
      latestRequestId: "req_error_1",
    });
  });

  it("reports runtime auth token configuration status", async () => {
    process.env.NYTE_RUNTIME_AUTH_TOKEN = "runtime-token";
    const configured = await getTrustReport(new Date("2026-01-20T12:10:00.000Z"));
    expect(configured.security.runtimeAuthTokenConfigured).toBe(true);

    process.env.NYTE_RUNTIME_AUTH_TOKEN = "   ";
    const blankValue = await getTrustReport(new Date("2026-01-20T12:10:00.000Z"));
    expect(blankValue.security.runtimeAuthTokenConfigured).toBe(false);
  });
});
