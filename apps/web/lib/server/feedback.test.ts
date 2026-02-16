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
import { approveWorkItem } from "./approve-action";
import { recordFeedback } from "./feedback";
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

describe("recordFeedback", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("records and updates feedback for processed items", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-01-20T12:00:00.000Z"));
    await approveWorkItem("w_renewal", new Date("2026-01-20T12:05:00.000Z"));

    const first = await recordFeedback(
      "w_renewal",
      "positive",
      "Draft was accurate and ready to send.",
      new Date("2026-01-20T12:06:00.000Z"),
    );
    const second = await recordFeedback(
      "w_renewal",
      "negative",
      "Need a shorter opener.",
      new Date("2026-01-20T12:07:00.000Z"),
    );

    expect(first.rating).toBe("positive");
    expect(second.rating).toBe("negative");

    const rows = await db.select().from(feedbackEntries);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.rating).toBe("negative");
    expect(rows[0]?.note).toContain("shorter opener");
  });
});
