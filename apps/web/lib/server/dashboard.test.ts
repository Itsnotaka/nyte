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

import { mockIntakeSignals } from "../domain/mock-intake";
import { approveWorkItem } from "./approve-action";
import { getDashboardData } from "./dashboard";
import { dismissWorkItem } from "./dismiss-action";
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

describe("getDashboardData", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("returns needs-you, drafts, and processed sections from persisted state", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-01-20T12:00:00.000Z"));
    await approveWorkItem("w_renewal", new Date("2026-01-20T12:05:00.000Z"));
    await dismissWorkItem("w_board", new Date("2026-01-20T12:10:00.000Z"));
    await recordFeedback("w_renewal", "positive", undefined, new Date("2026-01-20T12:11:00.000Z"));

    const dashboard = await getDashboardData();

    expect(dashboard.needsYou.map((item) => item.id)).toContain("w_refund");
    expect(dashboard.drafts.map((draft) => draft.id)).toContain("w_renewal");
    expect(dashboard.processed.map((entry) => entry.itemId)).toEqual(
      expect.arrayContaining(["w_renewal", "w_board"]),
    );
    expect(dashboard.processed.find((entry) => entry.itemId === "w_renewal")?.feedback).toBe(
      "positive",
    );
  });

  it("skips malformed action payloads without breaking dashboard hydration", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-01-20T12:00:00.000Z"));
    await approveWorkItem("w_renewal", new Date("2026-01-20T12:05:00.000Z"));

    await db
      .update(proposedActions)
      .set({
        payloadJson: "{bad-json",
      })
      .where(eq(proposedActions.workItemId, "w_renewal"));

    const dashboard = await getDashboardData();

    expect(dashboard.needsYou.map((item) => item.id)).toContain("w_board");
    expect(dashboard.processed.find((entry) => entry.itemId === "w_renewal")?.detail).toBe(
      "action_payload • unreadable",
    );
  });
});
