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

import { mockIntakeSignals } from "../domain/mock-intake";
import { dismissWorkItem } from "./dismiss-action";
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

describe("dismissWorkItem", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("marks work item and proposed action as dismissed", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-01-20T12:00:00.000Z"));

    const result = await dismissWorkItem("w_renewal", new Date("2026-01-20T12:05:00.000Z"));

    expect(result.status).toBe("dismissed");

    const item = await db.select().from(workItems);
    const action = await db.select().from(proposedActions);
    expect(item.find((row) => row.id === "w_renewal")?.status).toBe("dismissed");
    expect(action.find((row) => row.workItemId === "w_renewal")?.status).toBe("dismissed");
  });

  it("returns idempotent response when dismissing same item twice", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-01-20T12:00:00.000Z"));

    const first = await dismissWorkItem("w_renewal", new Date("2026-01-20T12:05:00.000Z"));
    const second = await dismissWorkItem("w_renewal", new Date("2026-01-20T12:10:00.000Z"));

    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);
  });
});
