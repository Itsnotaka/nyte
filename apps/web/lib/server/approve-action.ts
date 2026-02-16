import { eq } from "drizzle-orm";
import {
  calendarEvents,
  db,
  ensureDbSchema,
  gmailDrafts,
  proposedActions,
  workItems,
} from "@workspace/db";
import { type ToolCallPayload } from "@workspace/domain/actions";
import { executeProposedAction } from "@workspace/domain/execution";
import { Result } from "neverthrow";
import { recordAuditLog } from "./audit-log";
import { recordWorkflowRun } from "./workflow-log";

export class ApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalError";
  }
}

const TOOL_CALL_KINDS = new Set<ToolCallPayload["kind"]>([
  "gmail.createDraft",
  "google-calendar.createEvent",
  "billing.queueRefund",
]);

function safeParsePayload(payloadJson: string): ToolCallPayload | null {
  const parsedPayload = Result.fromThrowable(JSON.parse, () => null)(payloadJson);
  if (parsedPayload.isErr()) {
    return null;
  }
  const parsed = parsedPayload.value as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const kind = (parsed as { kind?: unknown }).kind;
  if (typeof kind !== "string" || !TOOL_CALL_KINDS.has(kind as ToolCallPayload["kind"])) {
    return null;
  }

  return parsed as ToolCallPayload;
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

async function resolveExecutionSnapshot(
  proposalId: string,
  payload: ToolCallPayload,
  updatedAt: unknown,
  idempotencyKey?: string,
) {
  if (payload.kind === "gmail.createDraft") {
    const draftRows = await db
      .select()
      .from(gmailDrafts)
      .where(eq(gmailDrafts.actionId, proposalId))
      .limit(1);
    const draft = draftRows.at(0);
    return {
      status: "executed" as const,
      destination: "gmail_drafts" as const,
      providerReference:
        draft?.providerDraftId ??
        executeProposedAction(payload, new Date(toIso(updatedAt)), { idempotencyKey })
          .providerReference,
      idempotencyKey:
        idempotencyKey ?? executeProposedAction(payload, new Date(toIso(updatedAt))).idempotencyKey,
      executedAt: toIso(draft?.syncedAt ?? updatedAt),
    };
  }

  if (payload.kind === "google-calendar.createEvent") {
    const eventRows = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.actionId, proposalId))
      .limit(1);
    const event = eventRows.at(0);
    return {
      status: "executed" as const,
      destination: "google_calendar" as const,
      providerReference:
        event?.providerEventId ??
        executeProposedAction(payload, new Date(toIso(updatedAt)), { idempotencyKey })
          .providerReference,
      idempotencyKey:
        idempotencyKey ?? executeProposedAction(payload, new Date(toIso(updatedAt))).idempotencyKey,
      executedAt: toIso(event?.syncedAt ?? updatedAt),
    };
  }

  const execution = executeProposedAction(payload, new Date(toIso(updatedAt)), {
    idempotencyKey,
  });
  return execution;
}

export async function approveWorkItem(itemId: string, now = new Date(), idempotencyKey?: string) {
  await ensureDbSchema();

  const itemRows = await db.select().from(workItems).where(eq(workItems.id, itemId)).limit(1);
  const workItem = itemRows.at(0);
  if (!workItem) {
    throw new ApprovalError("Work item not found.");
  }
  if (workItem.status === "dismissed") {
    throw new ApprovalError("Work item is dismissed and cannot be approved.");
  }

  const action = await db
    .select()
    .from(proposedActions)
    .where(eq(proposedActions.workItemId, itemId))
    .limit(1);

  const proposal = action.at(0);
  if (!proposal) {
    throw new ApprovalError("No proposed action found for work item.");
  }

  const payload = safeParsePayload(proposal.payloadJson);
  if (!payload) {
    throw new ApprovalError("Proposed action payload is invalid.");
  }
  if (workItem.status === "completed" || proposal.status === "executed") {
    const execution = await resolveExecutionSnapshot(
      proposal.id,
      payload,
      workItem.updatedAt,
      idempotencyKey,
    );
    await recordAuditLog({
      userId: workItem.userId,
      action: "action.approve.idempotent",
      targetType: "work_item",
      targetId: itemId,
      payload: {
        idempotencyKey: execution.idempotencyKey,
      },
      now,
    });
    return {
      itemId,
      payload,
      execution,
      idempotent: true,
    };
  }

  const execution = executeProposedAction(payload, now, {
    idempotencyKey,
  });

  await db.transaction(async (tx) => {
    await tx
      .update(proposedActions)
      .set({
        status: "executed",
        updatedAt: now,
      })
      .where(eq(proposedActions.id, proposal.id));

    if (execution.destination === "gmail_drafts") {
      await tx
        .insert(gmailDrafts)
        .values({
          id: `${proposal.id}:gmail`,
          actionId: proposal.id,
          providerDraftId: execution.providerReference,
          threadId: itemId,
          syncedAt: now,
        })
        .onConflictDoUpdate({
          target: gmailDrafts.id,
          set: {
            providerDraftId: execution.providerReference,
            syncedAt: now,
          },
        });
    }

    if (execution.destination === "google_calendar") {
      const startsAt =
        payload.kind === "google-calendar.createEvent" ? new Date(payload.startsAt) : now;
      const endsAt =
        payload.kind === "google-calendar.createEvent" ? new Date(payload.endsAt) : now;

      await tx
        .insert(calendarEvents)
        .values({
          id: `${proposal.id}:calendar`,
          actionId: proposal.id,
          providerEventId: execution.providerReference,
          startsAt,
          endsAt,
          syncedAt: now,
        })
        .onConflictDoUpdate({
          target: calendarEvents.id,
          set: {
            providerEventId: execution.providerReference,
            startsAt,
            endsAt,
            syncedAt: now,
          },
        });
    }

    await tx
      .update(workItems)
      .set({
        status: "completed",
        updatedAt: now,
      })
      .where(eq(workItems.id, itemId));

    await recordWorkflowRun({
      workItemId: itemId,
      phase: "approve",
      status: "completed",
      now,
      executor: tx,
      events: [
        {
          kind: "action.approved",
          payload: {
            actionId: proposal.id,
            kind: payload.kind,
          },
        },
        {
          kind: "action.executed",
          payload: {
            destination: execution.destination,
            providerReference: execution.providerReference,
            idempotencyKey: execution.idempotencyKey,
          },
        },
      ],
    });

    await recordAuditLog({
      userId: workItem.userId,
      action: "action.approve",
      targetType: "work_item",
      targetId: itemId,
      payload: {
        destination: execution.destination,
        providerReference: execution.providerReference,
        idempotencyKey: execution.idempotencyKey,
      },
      now,
      executor: tx,
    });
  });

  return {
    itemId,
    payload,
    execution,
    idempotent: false,
  };
}
