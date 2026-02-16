import { randomUUID } from "node:crypto";
import { asc, desc, eq } from "drizzle-orm";
import { db, ensureDbSchema, workflowEvents, workflowRuns } from "@nyte/db";
import { Result } from "neverthrow";

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
  executor?: Pick<typeof db, "insert">;
};

export async function recordWorkflowRun({
  workItemId,
  phase,
  status,
  events,
  now = new Date(),
  executor = db,
}: RecordRunInput) {
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

function safeParsePayload(payloadJson: string): Record<string, unknown> {
  const parsedPayload = Result.fromThrowable(JSON.parse, () => null)(payloadJson);
  if (parsedPayload.isErr()) {
    return {
      parseError: true,
      rawPayload: payloadJson,
    };
  }
  const parsed = parsedPayload.value as unknown;
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }

  return {
    value: parsed,
  };
}

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
        payload: safeParsePayload(event.payloadJson),
        at: toIso(event.createdAt),
      })),
    });
  }

  return timeline;
}
