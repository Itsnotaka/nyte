import { v } from "convex/values";
import { nanoid } from "nanoid";

import { query, type MutationCtx } from "./_generated/server";
import { requireAuthUserId } from "./lib/auth";

type WorkflowPhase = "ingest" | "approve" | "dismiss" | "feedback";
type WorkflowStatus = "completed" | "failed";

type WorkflowEvent = {
  kind: string;
  payload: Record<string, unknown>;
};

function createRunId(
  workItemId: string,
  phase: WorkflowPhase,
  now: number
): string {
  return `${workItemId}:${phase}:${now}:${nanoid(10)}`;
}

function parseEventPayload(payloadJson: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(payloadJson);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return {
      parseError: true,
      rawPayload: payloadJson,
    };
  }
}

export type RecordWorkItemRunInput = {
  workItemId: string;
  phase: WorkflowPhase;
  status: WorkflowStatus;
  events?: WorkflowEvent[];
  now?: number;
};

export async function recordWorkItemRun(
  ctx: MutationCtx,
  {
    workItemId,
    phase,
    status,
    events = [],
    now = Date.now(),
  }: RecordWorkItemRunInput
): Promise<string> {
  const runId = createRunId(workItemId, phase, now);
  const runDocId = await ctx.db.insert("workflowRuns", {
    workItemId,
    phase,
    status,
    createdAt: now,
    updatedAt: now,
  });

  for (const [index, event] of events.entries()) {
    await ctx.db.insert("workflowEvents", {
      runId: runDocId,
      kind: `${event.kind}:${index}`,
      payloadJson: JSON.stringify(event.payload),
      createdAt: now,
    });
  }

  return runId;
}

export const timeline = query({
  args: {
    workItemId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx);
    const runs = await ctx.db
      .query("workflowRuns")
      .withIndex("by_work_item_created_at", (q) =>
        q.eq("workItemId", args.workItemId)
      )
      .order("desc")
      .collect();

    const timelineRows: Array<{
      runId: string;
      phase: WorkflowPhase;
      status: WorkflowStatus;
      at: number;
      events: Array<{
        kind: string;
        payload: Record<string, unknown>;
        at: number;
      }>;
    }> = [];

    for (const run of runs) {
      const events = await ctx.db
        .query("workflowEvents")
        .withIndex("by_run_id", (q) => q.eq("runId", run._id))
        .order("asc")
        .collect();

      timelineRows.push({
        runId: run._id,
        phase: run.phase,
        status: run.status,
        at: run.createdAt,
        events: events.map((event) => ({
          kind: event.kind,
          payload: parseEventPayload(event.payloadJson),
          at: event.createdAt,
        })),
      });
    }

    return timelineRows;
  },
});
