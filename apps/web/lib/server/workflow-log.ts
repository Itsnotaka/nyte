import { asc, desc, eq } from "drizzle-orm";
import { db, ensureDbSchema, workflowEvents, workflowRuns } from "@workspace/db";

type WorkflowLogEvent = {
  kind: string;
  payload: Record<string, unknown>;
};

type RecordRunInput = {
  workItemId: string;
  phase: "ingest" | "approve" | "dismiss" | "feedback";
  status: "completed";
  events: WorkflowLogEvent[];
  now?: Date;
};

export async function recordWorkflowRun({
  workItemId,
  phase,
  status,
  events,
  now = new Date(),
}: RecordRunInput) {
  const runId = `${workItemId}:${phase}:${now.getTime()}`;
  await db.insert(workflowRuns).values({
    id: runId,
    workItemId,
    phase,
    status,
    createdAt: now,
    updatedAt: now,
  });

  if (events.length > 0) {
    await db.insert(workflowEvents).values(
      events.map((event, index) => ({
        id: `${runId}:${index}`,
        runId,
        kind: event.kind,
        payloadJson: JSON.stringify(event.payload),
        createdAt: now,
      })),
    );
  }

  return runId;
}

export type WorkflowTimelineEntry = {
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

function toIso(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "number") {
    return new Date(value).toISOString();
  }

  return new Date().toISOString();
}

export async function getWorkflowTimeline(workItemId: string): Promise<WorkflowTimelineEntry[]> {
  await ensureDbSchema();

  const runs = await db
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.workItemId, workItemId))
    .orderBy(desc(workflowRuns.createdAt));

  const timeline: WorkflowTimelineEntry[] = [];
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
      at: toIso(run.createdAt),
      events: events.map((event) => ({
        kind: event.kind,
        payload: JSON.parse(event.payloadJson) as Record<string, unknown>,
        at: toIso(event.createdAt),
      })),
    });
  }

  return timeline;
}
