import { randomUUID } from "node:crypto";

import { db } from "@nyte/db/client";
import { proposedActions, workItems } from "@nyte/db/schema";
import {
  createProposedActionId,
  type ToolCallPayload,
} from "@nyte/domain/actions";

import { requireUserId } from "../identity/user-id";

type QueueSource = "Gmail" | "Google Calendar";

function resolveSource(payload: ToolCallPayload): QueueSource {
  if (payload.kind === "google-calendar.createEvent") {
    return "Google Calendar";
  }

  return "Gmail";
}

function defaultSummary(payload: ToolCallPayload): string {
  if (payload.kind === "google-calendar.createEvent") {
    return `Schedule event: ${payload.title}`;
  }

  if (payload.kind === "billing.queueRefund") {
    return `Queue refund for ${payload.customerName}`;
  }

  return `Draft email: ${payload.subject}`;
}

function normalizeSummary(summary: string, payload: ToolCallPayload): string {
  const normalized = summary.trim();
  if (normalized.length > 0) {
    return normalized.slice(0, 300);
  }

  return defaultSummary(payload).slice(0, 300);
}

function toPreview(payload: ToolCallPayload): string {
  if (payload.kind === "google-calendar.createEvent") {
    return `${payload.title} • ${payload.startsAt}`;
  }

  if (payload.kind === "billing.queueRefund") {
    return `${payload.customerName} • $${payload.amount.toFixed(2)} ${payload.currency}`;
  }

  return payload.body.slice(0, 500);
}

export async function queueToolCall(
  payload: ToolCallPayload,
  userId: string,
  summary: string,
  now = new Date()
): Promise<string> {
  const normalizedUserId = requireUserId(userId);
  const itemId = `agent:${now.getTime()}:${randomUUID()}`;
  const actionId = createProposedActionId(itemId);

  await db.transaction(async (tx) => {
    await tx.insert(workItems).values({
      id: itemId,
      userId: normalizedUserId,
      source: resolveSource(payload),
      actor: "You",
      summary: normalizeSummary(summary, payload),
      context: "Queued from command input.",
      preview: toPreview(payload),
      status: "awaiting_approval",
      priorityScore: 10,
      importanceTier: "critical",
      importanceScore: 95,
      importanceReason: "manual command",
      importanceVersion: "importance-v1",
      classifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(proposedActions).values({
      id: actionId,
      workItemId: itemId,
      actionType: payload.kind,
      status: "pending",
      payloadJson: JSON.stringify(payload),
      createdAt: now,
      updatedAt: now,
    });
  });

  return itemId;
}
