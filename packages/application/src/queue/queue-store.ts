import { db } from "@nyte/db/client";
import { gateEvaluations, proposedActions, workItems } from "@nyte/db/schema";
import {
  createProposedActionId,
  createToolCallPayload,
} from "@nyte/domain/actions";
import {
  evaluateApprovalGates,
  toWorkItem,
  type IntakeSignal,
  type WorkItem,
} from "@nyte/domain/triage";
import {
  classifyImportance,
  PI_RUNTIME_AI_MODELS,
  PI_RUNTIME_AI_PROVIDERS,
  type ImportanceTier,
} from "@nyte/extension-runtime";
import { eq } from "drizzle-orm";
import { Effect } from "effect";

import { recordAuditLog } from "../audit/audit-log";
import { requireUserId } from "../identity/user-id";
import { recordWorkItemRun } from "../run-log";

type ImportanceClassification = {
  tier: ImportanceTier;
  score: number;
  reason: string;
  confidence: number;
  provider: string;
  model: string;
};

const IMPORTANCE_VERSION = "importance-v1";

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, value));
}

function toImportanceTier(score: number): ImportanceTier {
  if (score >= 85) {
    return "critical";
  }

  if (score >= 70) {
    return "important";
  }

  return "later";
}

function evaluateRuleImportance(
  signal: IntakeSignal,
  now: Date
): {
  score: number;
  reason: string;
  borderline: boolean;
} {
  let score = 0;
  const reasons: string[] = [];
  const relationshipScore = clamp(signal.relationshipScore ?? 0, 0, 1);
  const impactScore = clamp(signal.impactScore ?? 0, 0, 1);
  const urgencyText =
    `${signal.summary} ${signal.preview} ${signal.context}`.toLowerCase();

  if (signal.watchMatched) {
    score += 30;
    reasons.push("watch keyword");
  }

  if (signal.intent === "refund_request") {
    score += 25;
    reasons.push("refund request");
  }

  if (signal.requiresDecision) {
    score += 12;
    reasons.push("owner decision");
  }

  if (relationshipScore >= 0.8) {
    score += 14;
    reasons.push("high relationship");
  } else if (relationshipScore >= 0.7) {
    score += 8;
    reasons.push("moderate relationship");
  }

  if (impactScore >= 0.8) {
    score += 15;
    reasons.push("high impact");
  } else if (impactScore >= 0.7) {
    score += 10;
    reasons.push("material impact");
  }

  if (signal.deadlineAt) {
    const deadline = new Date(signal.deadlineAt);
    const delta = deadline.getTime() - now.getTime();
    if (Number.isFinite(delta) && delta <= 48 * 60 * 60 * 1000) {
      score += 14;
      reasons.push("deadline under 48h");
    }
  }

  if (
    urgencyText.includes("urgent") ||
    urgencyText.includes("blocked") ||
    urgencyText.includes("asap") ||
    urgencyText.includes("deadline")
  ) {
    score += 10;
    reasons.push("urgency language");
  }

  const normalizedScore = clamp(Math.round(score), 0, 100);
  return {
    score: normalizedScore,
    reason: reasons.length > 0 ? reasons.join(", ") : "rules baseline",
    borderline: normalizedScore >= 55 && normalizedScore < 85,
  };
}

async function classifySignalImportance(
  signal: IntakeSignal,
  now: Date
): Promise<ImportanceClassification> {
  const rules = evaluateRuleImportance(signal, now);

  if (!rules.borderline) {
    return {
      tier: toImportanceTier(rules.score),
      score: rules.score,
      reason: rules.reason,
      confidence: 0.8,
      provider: PI_RUNTIME_AI_PROVIDERS.opencode,
      model: PI_RUNTIME_AI_MODELS.zen,
    };
  }

  const llmClassification = await classifyImportance({
    summary: signal.summary,
    context: signal.context,
    preview: signal.preview,
    ruleScore: rules.score,
    provider: PI_RUNTIME_AI_PROVIDERS.opencode,
    model: PI_RUNTIME_AI_MODELS.zen,
  });

  return {
    tier: llmClassification.tier,
    score: clamp(llmClassification.score, 0, 100),
    reason: llmClassification.reason,
    confidence: clamp(llmClassification.confidence, 0, 1),
    provider: llmClassification.provider,
    model: llmClassification.model,
  };
}

async function upsertWorkItem(
  signal: IntakeSignal,
  userId: string,
  now: Date
): Promise<WorkItem | null> {
  const normalizedUserId = requireUserId(userId);
  const workItem = toWorkItem(signal, now);
  if (!workItem) {
    return null;
  }
  const importance = await classifySignalImportance(signal, now);

  await db.transaction(async (tx) => {
    await tx
      .insert(workItems)
      .values({
        id: workItem.id,
        userId: normalizedUserId,
        source: workItem.source,
        actor: workItem.actor,
        summary: workItem.summary,
        context: workItem.context,
        preview: workItem.preview,
        status: "awaiting_approval",
        priorityScore: workItem.priorityScore,
        importanceTier: importance.tier,
        importanceScore: importance.score,
        importanceReason: importance.reason,
        importanceVersion: IMPORTANCE_VERSION,
        classifiedAt: now,
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
          importanceTier: importance.tier,
          importanceScore: importance.score,
          importanceReason: importance.reason,
          importanceVersion: IMPORTANCE_VERSION,
          classifiedAt: now,
          updatedAt: now,
        },
      });

    const evaluations = evaluateApprovalGates(signal, now);
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

    await recordWorkItemRun({
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
        {
          kind: "importance.classified",
          payload: {
            tier: importance.tier,
            score: importance.score,
            confidence: importance.confidence,
            provider: importance.provider,
            model: importance.model,
          },
        },
      ],
    });

    await recordAuditLog({
      userId: normalizedUserId,
      action: "work-item.ingested",
      targetType: "work_item",
      targetId: workItem.id,
      payload: {
        source: signal.source,
        priorityScore: workItem.priorityScore,
        importanceTier: importance.tier,
        importanceScore: importance.score,
      },
      now,
      executor: tx,
    });
  });

  return workItem;
}

export async function persistSignals(
  signals: IntakeSignal[],
  userId: string,
  now = new Date()
): Promise<WorkItem[]> {
  const normalizedUserId = requireUserId(userId);
  const queue: WorkItem[] = [];
  for (const signal of signals) {
    const workItem = await upsertWorkItem(signal, normalizedUserId, now);
    if (workItem) {
      queue.push(workItem);
    }
  }

  return queue.sort((left, right) => right.priorityScore - left.priorityScore);
}

export const persistSignalsProgram = (
  signals: IntakeSignal[],
  userId: string,
  now = new Date()
) => Effect.tryPromise(() => persistSignals(signals, userId, now));
