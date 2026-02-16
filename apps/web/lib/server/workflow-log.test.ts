import { beforeEach, describe, expect, it } from "vitest";
import {
  calendarEvents,
  connectedAccounts,
  db,
  ensureDbSchema,
  gateEvaluations,
  gmailDrafts,
  proposedActions,
  users,
  workflowEvents,
  workflowRuns,
  workItems,
} from "@workspace/db";

import { mockIntakeSignals } from "../domain/mock-intake";
import { approveWorkItem } from "./approve-action";
import { persistSignals } from "./queue-store";
import { getWorkflowTimeline } from "./workflow-log";

async function resetDb() {
  await ensureDbSchema();
  await db.delete(calendarEvents);
  await db.delete(gmailDrafts);
  await db.delete(workflowEvents);
  await db.delete(workflowRuns);
  await db.delete(proposedActions);
  await db.delete(gateEvaluations);
  await db.delete(workItems);
  await db.delete(connectedAccounts);
  await db.delete(users);
}

describe("getWorkflowTimeline", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("returns ingest and approve runs for processed work item", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-01-20T12:00:00.000Z"));
    await approveWorkItem("w_renewal", new Date("2026-01-20T12:05:00.000Z"));

    const timeline = await getWorkflowTimeline("w_renewal");

    expect(timeline.length).toBeGreaterThanOrEqual(2);
    expect(timeline.map((entry) => entry.phase)).toEqual(
      expect.arrayContaining(["ingest", "approve"]),
    );
  });
});
