import { eq } from "drizzle-orm";
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

import { ApprovalError, approveWorkItem } from "./approve-action";
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

describe("approveWorkItem", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("executes gmail draft action and records provider draft id", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-01-20T12:00:00.000Z"));

    const result = await approveWorkItem("w_renewal", new Date("2026-01-20T12:05:00.000Z"));

    expect(result.execution.destination).toBe("gmail_drafts");
    expect(result.execution.idempotencyKey).toContain("exec_");

    const draftRows = await db.select().from(gmailDrafts);
    expect(draftRows).toHaveLength(1);
    expect(draftRows[0]?.providerDraftId).toBe(result.execution.providerReference);
  });

  it("executes calendar action and records provider event id", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-01-20T12:00:00.000Z"));

    const result = await approveWorkItem("w_board", new Date("2026-01-20T12:05:00.000Z"));

    expect(result.execution.destination).toBe("google_calendar");
    expect(result.execution.idempotencyKey).toContain("exec_");
    const eventRows = await db.select().from(calendarEvents);
    expect(eventRows).toHaveLength(1);
    expect(eventRows[0]?.providerEventId).toBe(result.execution.providerReference);
  });

  it("returns idempotent response for duplicate approval requests", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-01-20T12:00:00.000Z"));

    const first = await approveWorkItem(
      "w_renewal",
      new Date("2026-01-20T12:05:00.000Z"),
      "approve:w_renewal",
    );
    const second = await approveWorkItem(
      "w_renewal",
      new Date("2026-01-20T12:07:00.000Z"),
      "approve:w_renewal",
    );

    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);
    expect(second.execution.providerReference).toBe(first.execution.providerReference);
    expect(second.execution.idempotencyKey).toBe("approve:w_renewal");

    const draftRows = await db.select().from(gmailDrafts);
    expect(draftRows).toHaveLength(1);
  });

  it("throws ApprovalError when persisted action payload is malformed", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-01-20T12:00:00.000Z"));
    await db
      .update(proposedActions)
      .set({
        payloadJson: "{bad-json",
      })
      .where(eq(proposedActions.workItemId, "w_renewal"));

    await expect(
      approveWorkItem("w_renewal", new Date("2026-01-20T12:05:00.000Z")),
    ).rejects.toThrow(ApprovalError);
  });
});
