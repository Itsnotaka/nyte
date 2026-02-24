import { executeProposedAction } from "@nyte/domain/execution";
import {
  executeExtension,
  EXTENSION_AUTH_PROVIDERS,
  EXTENSION_AUTH_SCOPES,
  EXTENSION_AUDIT_SOURCES,
  EXTENSION_NAMES,
  type ExtensionRequest,
} from "@nyte/extension-runtime";
import { ConvexError, v } from "convex/values";
import { createRequestLogger } from "evlog";
import { nanoid } from "nanoid";

import "./evlog";
import { internal } from "./_generated/api";
import { mutation, type MutationCtx } from "./_generated/server";
import { recordAuditLog } from "./audit";
import { requireAuthUserId } from "./lib/auth";
import { recordWorkItemRun } from "./runlog";

const toolCallPayloadValidator = v.union(
  v.object({
    kind: v.literal("gmail.createDraft"),
    to: v.array(v.string()),
    subject: v.string(),
    body: v.string(),
  }),
  v.object({
    kind: v.literal("google-calendar.createEvent"),
    title: v.string(),
    startsAt: v.string(),
    endsAt: v.string(),
    attendees: v.array(v.string()),
    description: v.string(),
  }),
  v.object({
    kind: v.literal("billing.queueRefund"),
    customerName: v.string(),
    amount: v.number(),
    currency: v.literal("USD"),
    reason: v.string(),
  })
);

async function loadItemById(ctx: MutationCtx, userId: string, itemId: string) {
  const item = await ctx.db
    .query("queueItems")
    .withIndex("by_work_item_id", (q) => q.eq("workItemId", itemId))
    .unique();

  if (!item || item.userId !== userId) {
    throw new ConvexError("Item not found.");
  }

  return item;
}

type ActionExecution = {
  destination: "gmail_sent" | "google_calendar" | "refund_queue";
  providerReference: string;
  idempotencyKey: string;
  executedAt: number;
};

function toExecutionTimestamp(value: string, fallback: number): number {
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return fallback;
}

function extensionRequestForPayload({
  payload,
  userId,
  itemId,
  idempotencyKey,
}: {
  payload:
    | {
        kind: "gmail.createDraft";
        to: string[];
        subject: string;
        body: string;
      }
    | {
        kind: "google-calendar.createEvent";
        title: string;
        startsAt: string;
        endsAt: string;
        attendees: string[];
        description: string;
      };
  userId: string;
  itemId: string;
  idempotencyKey: string;
}): ExtensionRequest {
  if (payload.kind === "gmail.createDraft") {
    return {
      name: EXTENSION_NAMES.gmailSend,
      auth: {
        provider: EXTENSION_AUTH_PROVIDERS.google,
        userId,
        scopes: [...EXTENSION_AUTH_SCOPES.googleWorkspace],
      },
      idempotencyKey,
      audit: {
        workItemId: itemId,
        actionId: `${itemId}:action`,
        source: EXTENSION_AUDIT_SOURCES.decisionQueue,
      },
      input: payload,
    };
  }

  return {
    name: EXTENSION_NAMES.calendarCreateEvent,
    auth: {
      provider: EXTENSION_AUTH_PROVIDERS.google,
      userId,
      scopes: [...EXTENSION_AUTH_SCOPES.googleWorkspace],
    },
    idempotencyKey,
    audit: {
      workItemId: itemId,
      actionId: `${itemId}:action`,
      source: EXTENSION_AUDIT_SOURCES.decisionQueue,
    },
    input: payload,
  };
}

async function executePayload({
  payload,
  userId,
  itemId,
  now,
  idempotencyKey,
}: {
  payload:
    | {
        kind: "gmail.createDraft";
        to: string[];
        subject: string;
        body: string;
      }
    | {
        kind: "google-calendar.createEvent";
        title: string;
        startsAt: string;
        endsAt: string;
        attendees: string[];
        description: string;
      }
    | {
        kind: "billing.queueRefund";
        customerName: string;
        amount: number;
        currency: "USD";
        reason: string;
      };
  userId: string;
  itemId: string;
  now: number;
  idempotencyKey: string;
}): Promise<ActionExecution> {
  if (payload.kind === "billing.queueRefund") {
    const execution = executeProposedAction(payload, new Date(now), {
      idempotencyKey,
    });
    return {
      destination: execution.destination,
      providerReference: execution.providerReference,
      idempotencyKey: execution.idempotencyKey,
      executedAt: toExecutionTimestamp(execution.executedAt, now),
    };
  }

  const result = await executeExtension(
    extensionRequestForPayload({
      payload,
      userId,
      itemId,
      idempotencyKey,
    })
  );

  if (result.name === EXTENSION_NAMES.gmailSend) {
    return {
      destination: "gmail_sent",
      providerReference: result.output.providerMessageId,
      idempotencyKey: result.idempotencyKey,
      executedAt: toExecutionTimestamp(result.executedAt, now),
    };
  }

  if (result.name === EXTENSION_NAMES.calendarCreateEvent) {
    return {
      destination: "google_calendar",
      providerReference: result.output.providerEventId,
      idempotencyKey: result.idempotencyKey,
      executedAt: toExecutionTimestamp(result.executedAt, now),
    };
  }

  throw new ConvexError("Unsupported extension result.");
}

export const approve = mutation({
  args: {
    itemId: v.string(),
    payloadOverride: v.optional(toolCallPayloadValidator),
  },
  handler: async (ctx, args) => {
    const log = createRequestLogger({
      method: "mutation",
      path: "actions/approve",
    });
    log.set({ requestItemId: args.itemId });

    try {
      const userId = await requireAuthUserId(ctx);
      const item = await loadItemById(ctx, userId, args.itemId);
      log.set({
        userId,
        workItemId: item.workItemId,
        queueStatus: item.status,
        actionStatus: item.actionStatus ?? null,
      });

      if (item.status === "dismissed") {
        throw new ConvexError("Dismissed item cannot be approved.");
      }

      if (item.status === "completed" && item.actionStatus === "executed") {
        await recordAuditLog(ctx, {
          userId,
          action: "action.approve.idempotent",
          targetType: "work_item",
          targetId: item.workItemId,
          payload: {
            idempotencyKey: item.idempotencyKey ?? null,
          },
        });
        log.set({ idempotent: true, queueState: "already_executed" });
        return {
          ok: true,
          idempotent: true,
        };
      }

      const payload = args.payloadOverride ?? item.proposedAction;
      const now = Date.now();
      const idempotencyKey = item.idempotencyKey ?? `approve_${nanoid(12)}`;
      log.set({
        idempotent: false,
        actionKind: payload.kind,
        idempotencyKey,
      });

      try {
        const execution = await executePayload({
          payload,
          userId,
          itemId: item.workItemId,
          now,
          idempotencyKey,
        });

        await ctx.db.patch(item._id, {
          status: "completed",
          proposedAction: payload,
          actionStatus: "executed",
          actionDestination: execution.destination,
          providerReference: execution.providerReference,
          idempotencyKey: execution.idempotencyKey,
          executedAt: execution.executedAt,
          actionError: undefined,
          updatedAt: now,
        });

        await recordWorkItemRun(ctx, {
          workItemId: item.workItemId,
          phase: "approve",
          status: "completed",
          now,
          events: [
            {
              kind: "action.approved",
              payload: {
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

        await recordAuditLog(ctx, {
          userId,
          action: "action.approve",
          targetType: "work_item",
          targetId: item.workItemId,
          payload: {
            destination: execution.destination,
            providerReference: execution.providerReference,
            idempotencyKey: execution.idempotencyKey,
          },
          now,
        });
        await ctx.runMutation(internal.retrieval.upsertKnowledge, {
          userId,
          sourceType: "workflow_event",
          sourceId: `${item.workItemId}:approve:${now}`,
          summary: `Approved ${payload.kind} for ${item.summary}`,
          metadataJson: JSON.stringify({
            workItemId: item.workItemId,
            destination: execution.destination,
          }),
        });
        log.set({
          executionDestination: execution.destination,
          providerReference: execution.providerReference,
          queueState: "executed",
        });

        return {
          ok: true,
          idempotent: false,
          execution,
        };
      } catch (error) {
        const message =
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : "Unable to execute approval action.";

        await ctx.db.patch(item._id, {
          actionStatus: "failed",
          actionError: message,
          updatedAt: now,
        });

        await recordWorkItemRun(ctx, {
          workItemId: item.workItemId,
          phase: "approve",
          status: "failed",
          now,
          events: [
            {
              kind: "action.execution_failed",
              payload: {
                message,
              },
            },
          ],
        });

        await recordAuditLog(ctx, {
          userId,
          action: "action.approve.failed",
          targetType: "work_item",
          targetId: item.workItemId,
          payload: {
            message,
          },
          now,
        });
        log.error(new Error(message), {
          step: "execution",
          actionKind: payload.kind,
        });

        throw new ConvexError(message);
      }
    } finally {
      log.emit();
    }
  },
});

export const dismiss = mutation({
  args: {
    itemId: v.string(),
  },
  handler: async (ctx, args) => {
    const log = createRequestLogger({
      method: "mutation",
      path: "actions/dismiss",
    });
    log.set({ requestItemId: args.itemId });

    try {
      const userId = await requireAuthUserId(ctx);
      const item = await loadItemById(ctx, userId, args.itemId);
      log.set({
        userId,
        workItemId: item.workItemId,
        queueStatus: item.status,
      });
      if (item.status === "completed") {
        throw new ConvexError("Completed item cannot be dismissed.");
      }

      const now = Date.now();
      if (item.status === "dismissed") {
        await recordAuditLog(ctx, {
          userId,
          action: "action.dismiss.idempotent",
          targetType: "work_item",
          targetId: item.workItemId,
          payload: {},
          now,
        });
        log.set({ idempotent: true, queueState: "already_dismissed" });
        return { ok: true, idempotent: true };
      }

      await ctx.db.patch(item._id, {
        status: "dismissed",
        actionStatus: "dismissed",
        updatedAt: now,
      });

      await recordWorkItemRun(ctx, {
        workItemId: item.workItemId,
        phase: "dismiss",
        status: "completed",
        now,
        events: [
          {
            kind: "action.dismissed",
            payload: {
              reason: "user dismissed from queue",
            },
          },
        ],
      });

      await recordAuditLog(ctx, {
        userId,
        action: "action.dismiss",
        targetType: "work_item",
        targetId: item.workItemId,
        payload: {},
        now,
      });
      await ctx.runMutation(internal.retrieval.upsertKnowledge, {
        userId,
        sourceType: "workflow_event",
        sourceId: `${item.workItemId}:dismiss:${now}`,
        summary: `Dismissed ${item.proposedAction.kind} for ${item.summary}`,
        metadataJson: JSON.stringify({
          workItemId: item.workItemId,
        }),
      });
      log.set({ idempotent: false, queueState: "dismissed" });

      return { ok: true, idempotent: false };
    } finally {
      log.emit();
    }
  },
});

export const feedback = mutation({
  args: {
    itemId: v.string(),
    rating: v.union(v.literal("positive"), v.literal("negative")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const log = createRequestLogger({
      method: "mutation",
      path: "actions/feedback",
    });
    log.set({
      requestItemId: args.itemId,
      rating: args.rating,
      hasNote: Boolean(args.note?.trim()),
    });

    try {
      const userId = await requireAuthUserId(ctx);
      const item = await loadItemById(ctx, userId, args.itemId);
      log.set({
        userId,
        workItemId: item.workItemId,
        queueStatus: item.status,
      });
      if (item.status !== "completed" && item.status !== "dismissed") {
        throw new ConvexError(
          "Feedback is only available for processed items."
        );
      }

      const existing = await ctx.db
        .query("feedbackEntries")
        .withIndex("by_work_item_id", (q) => q.eq("workItemId", args.itemId))
        .unique();

      const now = Date.now();
      if (existing) {
        await ctx.db.patch(existing._id, {
          rating: args.rating,
          note: args.note,
          updatedAt: now,
        });
        log.set({ mode: "update" });
      } else {
        await ctx.db.insert("feedbackEntries", {
          workItemId: args.itemId,
          userId,
          rating: args.rating,
          note: args.note,
          createdAt: now,
          updatedAt: now,
        });
        log.set({ mode: "insert" });
      }

      await recordWorkItemRun(ctx, {
        workItemId: item.workItemId,
        phase: "feedback",
        status: "completed",
        now,
        events: [
          {
            kind: "feedback.recorded",
            payload: {
              rating: args.rating,
              hasNote: Boolean(args.note?.trim()),
            },
          },
        ],
      });

      await recordAuditLog(ctx, {
        userId,
        action: "feedback.recorded",
        targetType: "work_item",
        targetId: item.workItemId,
        payload: {
          rating: args.rating,
        },
        now,
      });
      await ctx.runMutation(internal.retrieval.upsertKnowledge, {
        userId,
        sourceType: "feedback",
        sourceId: `${item.workItemId}:feedback`,
        summary: `Feedback ${args.rating} for ${item.summary}`,
        metadataJson: JSON.stringify({
          workItemId: item.workItemId,
          rating: args.rating,
        }),
      });
      log.set({ feedbackState: "recorded" });

      return { ok: true };
    } finally {
      log.emit();
    }
  },
});
