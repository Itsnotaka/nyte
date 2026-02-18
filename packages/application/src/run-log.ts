import { randomUUID } from "node:crypto";

import { db } from "@nyte/db/client";
import { workflowEvents, workflowRuns } from "@nyte/db/schema";
import { asc, desc, eq } from "drizzle-orm";
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
      at: runTimestampSchema.parse(run.createdAt),
      events: events.map((event) => ({
        kind: event.kind,
        payload: workflowEventPayloadSchema.parse(event.payloadJson),
        at: runTimestampSchema.parse(event.createdAt),
      })),
    });
  }

  return timeline;
}
