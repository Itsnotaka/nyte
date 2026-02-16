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

import { recordWorkflowRun } from "./workflow-log";
import {
  WorkflowRetentionError,
  getWorkflowRetentionDays,
  pruneWorkflowHistoryIfDue,
  pruneWorkflowHistory,
  resetWorkflowRetentionState,
  setWorkflowRetentionDays,
} from "./workflow-retention";

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

describe("workflow retention policy", () => {
  beforeEach(async () => {
    await resetDb();
    delete process.env.NYTE_WORKFLOW_RETENTION_DAYS;
    resetWorkflowRetentionState();
  });

  it("stores retention days in policy rules", async () => {
    const initial = await getWorkflowRetentionDays();
    expect(initial.days).toBe(30);

    await setWorkflowRetentionDays(14, new Date("2026-01-20T12:00:00.000Z"));
    const updated = await getWorkflowRetentionDays();
    expect(updated.days).toBe(14);
    expect(updated.source).toBe("policy");
  });

  it("rejects non-integer retention day values", async () => {
    await expect(
      setWorkflowRetentionDays(14.5, new Date("2026-01-20T12:00:00.000Z")),
    ).rejects.toThrow(WorkflowRetentionError);
  });

  it("prunes stale workflow runs older than configured retention", async () => {
    await db.insert(users).values({
      id: "local-user",
      email: "local-user@nyte.dev",
      name: "Local Nyte User",
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2025-01-01T00:00:00.000Z"),
    });
    await db.insert(workItems).values({
      id: "w_old",
      userId: "local-user",
      source: "Gmail",
      actor: "Legacy",
      summary: "Old run",
      context: "Old run context",
      preview: "Old run preview",
      status: "completed",
      priorityScore: 80,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2025-01-01T00:00:00.000Z"),
    });
    await db.insert(workItems).values({
      id: "w_new",
      userId: "local-user",
      source: "Gmail",
      actor: "Recent",
      summary: "New run",
      context: "New run context",
      preview: "New run preview",
      status: "completed",
      priorityScore: 80,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await recordWorkflowRun({
      workItemId: "w_old",
      phase: "approve",
      status: "completed",
      now: new Date("2025-01-02T00:00:00.000Z"),
      events: [{ kind: "old", payload: {} }],
    });
    await recordWorkflowRun({
      workItemId: "w_new",
      phase: "approve",
      status: "completed",
      now: new Date("2026-01-19T00:00:00.000Z"),
      events: [{ kind: "new", payload: {} }],
    });
    await db.insert(auditLogs).values([
      {
        id: "audit:old",
        userId: "local-user",
        action: "old.audit",
        targetType: "work_item",
        targetId: "w_old",
        payloadJson: JSON.stringify({ run: "old" }),
        createdAt: new Date("2025-01-02T00:00:00.000Z"),
      },
      {
        id: "audit:new",
        userId: "local-user",
        action: "new.audit",
        targetType: "work_item",
        targetId: "w_new",
        payloadJson: JSON.stringify({ run: "new" }),
        createdAt: new Date("2026-01-19T00:00:00.000Z"),
      },
    ]);

    await setWorkflowRetentionDays(7, new Date("2026-01-20T00:00:00.000Z"));
    const result = await pruneWorkflowHistory(new Date("2026-01-20T00:00:00.000Z"));

    expect(result.prunedRuns).toBe(1);
    expect(result.prunedAuditLogs).toBe(1);
    expect(result.performed).toBe(true);
    expect(result.triggeredBy).toBe("manual");

    const remainingRuns = await db.select().from(workflowRuns);
    expect(remainingRuns).toHaveLength(1);
    expect(remainingRuns[0]?.workItemId).toBe("w_new");

    const remainingAuditRows = await db.select().from(auditLogs);
    expect(remainingAuditRows.map((row) => row.id)).toContain("audit:new");
    expect(remainingAuditRows.map((row) => row.id)).not.toContain("audit:old");
  });

  it("skips auto-prune when interval has not elapsed", async () => {
    const first = await pruneWorkflowHistoryIfDue(new Date("2026-01-20T00:00:00.000Z"), 60_000);
    const second = await pruneWorkflowHistoryIfDue(new Date("2026-01-20T00:00:30.000Z"), 60_000);

    expect(first.performed).toBe(true);
    expect(second.performed).toBe(false);
    expect(second.prunedRuns).toBe(0);
    expect(second.prunedAuditLogs).toBe(0);
  });
});
