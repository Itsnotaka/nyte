import { beforeEach, describe, expect, it } from "vitest";
import {
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

import { approveWorkItem } from "./approve-action";
import { upsertGoogleConnection } from "./connections";
import { addWatchKeyword } from "./policy-rules";
import { persistSignals } from "./queue-store";
import { getTrustReport } from "./trust-report";
import { setWorkflowRetentionDays } from "./workflow-retention";
import { mockIntakeSignals } from "../domain/mock-intake";

async function resetDb() {
  await ensureDbSchema();
  await db.delete(calendarEvents);
  await db.delete(gmailDrafts);
  await db.delete(feedbackEntries);
  await db.delete(workflowEvents);
  await db.delete(workflowRuns);
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
  });
});
