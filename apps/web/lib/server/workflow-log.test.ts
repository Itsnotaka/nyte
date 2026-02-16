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
import { persistSignals } from "./queue-store";
import { getWorkflowTimeline, recordWorkflowRun } from "./workflow-log";

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

  it("creates unique run ids for same work item and timestamp", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-01-20T12:00:00.000Z"));
    const now = new Date("2026-01-20T12:00:01.000Z");

    const firstRunId = await recordWorkflowRun({
      workItemId: "w_renewal",
      phase: "feedback",
      status: "completed",
      events: [],
      now,
    });
    const secondRunId = await recordWorkflowRun({
      workItemId: "w_renewal",
      phase: "feedback",
      status: "completed",
      events: [],
      now,
    });

    expect(firstRunId).not.toBe(secondRunId);

    const timeline = await getWorkflowTimeline("w_renewal");
    const matchingRunIds = timeline
      .filter((entry) => entry.phase === "feedback")
      .map((entry) => entry.runId);
    expect(matchingRunIds).toContain(firstRunId);
    expect(matchingRunIds).toContain(secondRunId);
  });

  it("gracefully handles malformed workflow event payload json", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-01-20T12:00:00.000Z"));
    const runId = await recordWorkflowRun({
      workItemId: "w_renewal",
      phase: "feedback",
      status: "completed",
      events: [],
      now: new Date("2026-01-20T12:00:02.000Z"),
    });

    await db.insert(workflowEvents).values({
      id: `${runId}:malformed`,
      runId,
      kind: "feedback.recorded",
      payloadJson: "{bad-json",
      createdAt: new Date("2026-01-20T12:00:02.000Z"),
    });

    const timeline = await getWorkflowTimeline("w_renewal");
    const feedbackRun = timeline.find((entry) => entry.runId === runId);
    const malformedEvent = feedbackRun?.events.find((event) => event.kind === "feedback.recorded");

    expect(feedbackRun).toBeTruthy();
    expect(malformedEvent?.payload).toEqual({
      parseError: true,
      rawPayload: "{bad-json",
    });
  });
});
