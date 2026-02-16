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
import {
  countAuditLogs,
  countAuditLogsByTarget,
  listAuditLogs,
  listAuditLogsByTarget,
  recordAuditLog,
} from "./audit-log";
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

describe("audit log recording", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("records entries for ingestion and approval operations", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-01-20T12:00:00.000Z"));
    await approveWorkItem("w_renewal", new Date("2026-01-20T12:05:00.000Z"));

    const logs = await listAuditLogs(50);
    const totalCount = await countAuditLogs();
    expect(logs.some((entry) => entry.action === "work-item.ingested")).toBe(true);
    expect(logs.some((entry) => entry.action === "action.approve")).toBe(true);
    expect(totalCount).toBe(logs.length);

    const filtered = await listAuditLogsByTarget("work_item", "w_renewal", 50);
    const filteredCount = await countAuditLogsByTarget("work_item", "w_renewal");
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((entry) => entry.targetId === "w_renewal")).toBe(true);
    expect(filteredCount).toBe(filtered.length);
  });

  it("creates unique ids when multiple logs share timestamp and target", async () => {
    const now = new Date("2026-01-20T12:10:00.000Z");
    await recordAuditLog({
      action: "test.event",
      targetType: "work_item",
      targetId: "w_duplicate",
      payload: {},
      now,
    });
    await recordAuditLog({
      action: "test.event",
      targetType: "work_item",
      targetId: "w_duplicate",
      payload: {},
      now,
    });

    const logs = await listAuditLogsByTarget("work_item", "w_duplicate", 10);
    expect(logs).toHaveLength(2);
    expect(new Set(logs.map((entry) => entry.id)).size).toBe(2);
  });

  it("gracefully handles malformed payload json in stored rows", async () => {
    await db.insert(auditLogs).values({
      id: "audit:bad-json",
      userId: null,
      action: "malformed.payload",
      targetType: "work_item",
      targetId: "w_bad",
      payloadJson: "{bad-json",
      createdAt: new Date("2026-01-20T12:11:00.000Z"),
    });

    const logs = await listAuditLogsByTarget("work_item", "w_bad", 10);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.payload).toEqual({
      parseError: true,
      rawPayload: "{bad-json",
    });
  });
});
