import { randomUUID } from "node:crypto";

import { db } from "@nyte/db/client";
import { workflowEvents, workflowRuns } from "@nyte/db/schema";
import { asc, desc, eq } from "drizzle-orm";

import { parseRecordPayload } from "./shared/payload";
import { toIsoString } from "./shared/time";

type WorkItemRunEvent = {
  kind: string;
  payload: Record<string, unknown>;
};

type RecordWorkItemRunInput = {
  workItemId: string;
  phase: "ingest" | "approve" | "dismiss" | "feedback";
  status: "completed";
  events: WorkItemRunEvent[];
  now?: Date;
  executor?: Pick<typeof db, "insert">;
};

export async function recordWorkItemRun({
  workItemId,
  phase,
  status,
  events,
  now = new Date(),
  executor = db,
}: RecordWorkItemRunInput) {
  const runId = `${workItemId}:${phase}:${now.getTime()}:${randomUUID()}`;
  await executor.insert(workflowRuns).values({
    id: runId,
    workItemId,
    phase,
    status,
    createdAt: now,
    updatedAt: now,
  });

  if (events.length > 0) {
    await executor.insert(workflowEvents).values(
      events.map((event, index) => ({
        id: `${runId}:${index}`,
        runId,
        kind: event.kind,
        payloadJson: JSON.stringify(event.payload),
        createdAt: now,
      }))
    );
  }

  return runId;
}

export type WorkItemRunTimelineEntry = {
  runId: string;
  phase: string;
  status: string;
  at: string;
  events: Array<{
    kind: string;
    payload: Record<string, unknown>;
    at: string;
  }>;
};

export async function listWorkItemRunTimeline(
  workItemId: string
): Promise<WorkItemRunTimelineEntry[]> {
  const runs = await db
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.workItemId, workItemId))
    .orderBy(desc(workflowRuns.createdAt));

  const timeline: WorkItemRunTimelineEntry[] = [];
  for (const run of runs) {
    const events = await db
      .select()
      .from(workflowEvents)
      .where(eq(workflowEvents.runId, run.id))
      .orderBy(asc(workflowEvents.createdAt));

    timeline.push({
      runId: run.id,
      phase: run.phase,
      status: run.status,
      at: toIsoString(run.createdAt),
      events: events.map((event) => ({
        kind: event.kind,
        payload: parseRecordPayload(event.payloadJson),
        at: toIsoString(event.createdAt),
      })),
    });
  }

  return timeline;
}
