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
import { mockIntakeSignals } from "@workspace/domain/mock-intake";

import { approveWorkItem } from "./approve-action";
import { dismissWorkItem } from "./dismiss-action";
import { recordFeedback } from "./feedback";
import { getMetricsSnapshot } from "./metrics";
import { persistSignals } from "./queue-store";

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

describe("getMetricsSnapshot", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("computes queue, precision, and timing metrics from persisted data", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-01-20T12:00:00.000Z"));
    await approveWorkItem("w_renewal", new Date("2026-01-20T12:05:00.000Z"));
    await dismissWorkItem("w_board", new Date("2026-01-20T12:10:00.000Z"));
    await recordFeedback(
      "w_renewal",
      "positive",
      "Great draft",
      new Date("2026-01-20T12:11:00.000Z"),
    );

    const snapshot = await getMetricsSnapshot(new Date("2026-01-20T12:15:00.000Z"));

    expect(snapshot.awaitingCount).toBe(1);
    expect(snapshot.completedCount).toBe(1);
    expect(snapshot.dismissedCount).toBe(1);
    expect(snapshot.interruptionPrecision).toBe(50);
    expect(snapshot.approvalRate).toBe(33.3);
    expect(snapshot.medianDecisionMinutes).toBe(7.5);
    expect(snapshot.feedbackCount).toBe(1);
    expect(snapshot.positiveFeedbackRate).toBe(100);
    expect(snapshot.gateHitCounts.decision).toBeGreaterThan(0);
    expect(snapshot.gateHitCounts.impact).toBeGreaterThan(0);
  });
});
