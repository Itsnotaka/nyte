import { beforeEach, describe, expect, it } from "vitest";
import {
  calendarEvents,
  connectedAccounts,
  db,
  ensureDbSchema,
  feedbackEntries,
  gateEvaluations,
  gmailDrafts,
  proposedActions,
  users,
  workflowEvents,
  workflowRuns,
  workItems,
} from "@workspace/db";

import { mockIntakeSignals } from "../domain/mock-intake";
import { persistSignals } from "./queue-store";

async function resetDb() {
  await ensureDbSchema();
  await db.delete(calendarEvents);
  await db.delete(gmailDrafts);
  await db.delete(feedbackEntries);
  await db.delete(workflowEvents);
  await db.delete(workflowRuns);
  await db.delete(proposedActions);
  await db.delete(gateEvaluations);
  await db.delete(workItems);
  await db.delete(connectedAccounts);
  await db.delete(users);
}

describe("persistSignals", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("stores queue-ready signals and gate evaluations", async () => {
    const queue = await persistSignals(mockIntakeSignals, new Date("2026-01-20T12:00:00.000Z"));

    expect(queue.length).toBe(3);
    const rows = await db.select().from(workItems);
    expect(rows.length).toBe(3);

    const gateRows = await db.select().from(gateEvaluations);
    expect(gateRows.length).toBeGreaterThan(0);
  });

  it("upserts work item data on repeated polls", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-01-20T12:00:00.000Z"));

    const updatedSignals = mockIntakeSignals.map((signal) =>
      signal.id === "w_renewal"
        ? { ...signal, summary: "Updated summary for renewal thread" }
        : signal,
    );

    await persistSignals(updatedSignals, new Date("2026-01-20T13:00:00.000Z"));

    const rows = await db.select().from(workItems);
    const renewal = rows.find((row) => row.id === "w_renewal");
    expect(renewal?.summary).toBe("Updated summary for renewal thread");
  });
});
