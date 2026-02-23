import { randomUUID } from "node:crypto";

import { db } from "@nyte/db/client";
import { workflowEvents, workflowRuns } from "@nyte/db/schema";
import { asc, desc, eq, inArray, lt, or } from "drizzle-orm";
import { Effect } from "effect";
import { z } from "zod";

const runTimestampSchema = z
  .date()
  .refine((value) => !Number.isNaN(value.getTime()), {
    message: "Invalid date value.",
  })
  .transform((value) => value.toISOString());

const workflowEventPayloadRecordSchema = z.record(z.string(), z.unknown());

const workflowEventPayloadSchema = z
  .string()
  .transform((payloadJson): unknown => {
    try {
      return JSON.parse(payloadJson);
    } catch {
      return {
        parseError: true,
        rawPayload: payloadJson,
      };
    }
  })
  .transform((payload): Record<string, unknown> => {
    const result = workflowEventPayloadRecordSchema.safeParse(payload);
    if (result.success) {
      return result.data;
    }

    return { value: payload };
  });

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

export const recordWorkItemRunProgram = (input: RecordWorkItemRunInput) =>
  Effect.tryPromise(() => recordWorkItemRun(input));

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

  if (runs.length === 0) {
    return [];
  }

  const runIds = runs.map((run) => run.id);
  const events = await db
    .select()
    .from(workflowEvents)
    .where(inArray(workflowEvents.runId, runIds))
    .orderBy(asc(workflowEvents.createdAt));

  const eventsByRunId = new Map<string, typeof events>();
  for (const event of events) {
    const existing = eventsByRunId.get(event.runId) ?? [];
    existing.push(event);
    eventsByRunId.set(event.runId, existing);
  }

  const timeline: WorkItemRunTimelineEntry[] = [];
  for (const run of runs) {
    const runEvents = eventsByRunId.get(run.id) ?? [];
    timeline.push({
      runId: run.id,
      phase: run.phase,
      status: run.status,
      at: runTimestampSchema.parse(run.createdAt),
      events: runEvents.map((event) => ({
        kind: event.kind,
        payload: workflowEventPayloadSchema.parse(event.payloadJson),
        at: runTimestampSchema.parse(event.createdAt),
      })),
    });
  }

  return timeline;
}

export const listWorkItemRunTimelineProgram = (workItemId: string) =>
  Effect.tryPromise(() => listWorkItemRunTimeline(workItemId));

export async function pruneWorkflowEvents({
  olderThan,
  now = new Date(),
}: {
  olderThan: Date;
  now?: Date;
}) {
  if (Number.isNaN(olderThan.getTime())) {
    throw new TypeError("Invalid date value.");
  }

  const oldRunRows = await db
    .select({
      id: workflowRuns.id,
    })
    .from(workflowRuns)
    .where(or(lt(workflowRuns.updatedAt, olderThan), lt(workflowRuns.createdAt, olderThan)));
  const runIds = oldRunRows.map((row) => row.id);

  if (runIds.length === 0) {
    return {
      deletedEvents: 0,
      deletedRuns: 0,
      prunedAt: runTimestampSchema.parse(now),
    };
  }

  const oldEventRows = await db
    .select({
      id: workflowEvents.id,
    })
    .from(workflowEvents)
    .where(inArray(workflowEvents.runId, runIds));

  await db
    .delete(workflowEvents)
    .where(inArray(workflowEvents.runId, runIds));
  await db
    .delete(workflowRuns)
    .where(inArray(workflowRuns.id, runIds));

  return {
    deletedEvents: oldEventRows.length,
    deletedRuns: runIds.length,
    prunedAt: runTimestampSchema.parse(now),
  };
}
