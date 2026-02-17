import { db } from "@nyte/db/client";
import { gateEvaluations, proposedActions, workItems } from "@nyte/db/schema";
import {
  createProposedActionId,
  createToolCallPayload,
} from "@nyte/domain/actions";
import {
  evaluateNeedsYou,
  toWorkItem,
  type IntakeSignal,
  type WorkItem,
} from "@nyte/domain/triage";
import { eq } from "drizzle-orm";

import { recordAuditLog } from "../audit/audit-log";
import { DEFAULT_USER_ID, ensureDefaultUser } from "../shared/default-user";
import { recordWorkflowRun } from "../workflow/workflow-log";

async function upsertWorkItem(
  signal: IntakeSignal,
  now: Date
): Promise<WorkItem | null> {
  const workItem = toWorkItem(signal, now);
  if (!workItem) {
    return null;
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(workItems)
      .values({
        id: workItem.id,
        userId: DEFAULT_USER_ID,
        source: workItem.source,
        actor: workItem.actor,
        summary: workItem.summary,
        context: workItem.context,
        preview: workItem.preview,
        status: "awaiting_approval",
        priorityScore: workItem.priorityScore,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: workItems.id,
        set: {
          source: workItem.source,
          actor: workItem.actor,
          summary: workItem.summary,
          context: workItem.context,
          preview: workItem.preview,
          status: "awaiting_approval",
          priorityScore: workItem.priorityScore,
          updatedAt: now,
        },
      });

    const evaluations = evaluateNeedsYou(signal, now);
    await tx
      .delete(gateEvaluations)
      .where(eq(gateEvaluations.workItemId, workItem.id));
    await tx.insert(gateEvaluations).values(
      evaluations.map((evaluation) => ({
        id: `${workItem.id}:${evaluation.gate}`,
        workItemId: workItem.id,
        gate: evaluation.gate,
        matched: evaluation.matched,
        reason: evaluation.reason,
        score: evaluation.score,
      }))
    );

    const payload = createToolCallPayload(workItem);
    await tx
      .delete(proposedActions)
      .where(eq(proposedActions.workItemId, workItem.id));
    await tx.insert(proposedActions).values({
      id: createProposedActionId(workItem.id),
      workItemId: workItem.id,
      actionType: payload.kind,
      status: "pending",
      payloadJson: JSON.stringify(payload),
      createdAt: now,
      updatedAt: now,
    });

    await recordWorkflowRun({
      workItemId: workItem.id,
      phase: "ingest",
      status: "completed",
      now,
      executor: tx,
      events: [
        {
          kind: "signal.persisted",
          payload: {
            source: signal.source,
            actor: signal.actor,
          },
        },
        {
          kind: "gates.evaluated",
          payload: {
            matched: evaluations
              .filter((entry) => entry.matched)
              .map((entry) => entry.gate),
          },
        },
        {
          kind: "action.prepared",
          payload: {
            kind: payload.kind,
          },
        },
      ],
    });

    await recordAuditLog({
      userId: DEFAULT_USER_ID,
      action: "work-item.ingested",
      targetType: "work_item",
      targetId: workItem.id,
      payload: {
        source: signal.source,
        priorityScore: workItem.priorityScore,
      },
      now,
      executor: tx,
    });
  });

  return workItem;
}

export async function persistSignals(
  signals: IntakeSignal[],
  now = new Date()
): Promise<WorkItem[]> {
  await ensureDefaultUser(now);

  const queue: WorkItem[] = [];
  for (const signal of signals) {
    const workItem = await upsertWorkItem(signal, now);
    if (workItem) {
      queue.push(workItem);
    }
  }

  return queue.sort((left, right) => right.priorityScore - left.priorityScore);
}
