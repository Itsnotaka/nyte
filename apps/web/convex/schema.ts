import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const gateValidator = v.union(
  v.literal("decision"),
  v.literal("time"),
  v.literal("relationship"),
  v.literal("impact"),
  v.literal("watch")
);

const sourceValidator = v.union(
  v.literal("Gmail"),
  v.literal("Google Calendar")
);
const workTypeValidator = v.union(
  v.literal("draft"),
  v.literal("calendar"),
  v.literal("refund")
);
const statusValidator = v.union(
  v.literal("awaiting_approval"),
  v.literal("completed"),
  v.literal("dismissed")
);
const importanceTierValidator = v.union(
  v.literal("critical"),
  v.literal("important"),
  v.literal("later")
);
const actionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("executed"),
  v.literal("dismissed"),
  v.literal("failed")
);
const actionDestinationValidator = v.union(
  v.literal("gmail_drafts"),
  v.literal("google_calendar"),
  v.literal("refund_queue")
);
const workflowPhaseValidator = v.union(
  v.literal("ingest"),
  v.literal("approve"),
  v.literal("dismiss"),
  v.literal("feedback")
);
const workflowStatusValidator = v.union(
  v.literal("completed"),
  v.literal("failed")
);

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

export default defineSchema({
  queueItems: defineTable({
    workItemId: v.string(),
    userId: v.string(),
    type: workTypeValidator,
    source: sourceValidator,
    actor: v.string(),
    summary: v.string(),
    context: v.string(),
    actionLabel: v.string(),
    secondaryLabel: v.string(),
    cta: v.union(
      v.literal("Save draft"),
      v.literal("Create event"),
      v.literal("Queue refund")
    ),
    gates: v.array(gateValidator),
    preview: v.string(),
    priorityScore: v.number(),
    status: statusValidator,
    proposedAction: toolCallPayloadValidator,
    importanceTier: v.optional(importanceTierValidator),
    importanceScore: v.optional(v.number()),
    importanceReason: v.optional(v.string()),
    importanceVersion: v.optional(v.string()),
    classifiedAt: v.optional(v.number()),
    actionStatus: v.optional(actionStatusValidator),
    actionDestination: v.optional(actionDestinationValidator),
    providerReference: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
    executedAt: v.optional(v.number()),
    actionError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_work_item_id", ["workItemId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_status_updated", ["userId", "status", "updatedAt"])
    .index("by_user_updated", ["userId", "updatedAt"]),

  ingestionState: defineTable({
    userId: v.string(),
    gmailCursor: v.optional(v.union(v.null(), v.string())),
    calendarCursor: v.optional(v.union(v.null(), v.string())),
    lastSyncedAt: v.optional(v.union(v.null(), v.number())),
    bootstrapCompletedAt: v.optional(v.union(v.null(), v.number())),
    lastError: v.optional(v.union(v.null(), v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_updated_at", ["updatedAt"]),

  feedbackEntries: defineTable({
    workItemId: v.string(),
    userId: v.string(),
    rating: v.union(v.literal("positive"), v.literal("negative")),
    note: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_work_item_id", ["workItemId"])
    .index("by_user_created_at", ["userId", "createdAt"]),

  auditLogs: defineTable({
    userId: v.optional(v.string()),
    action: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    payloadJson: v.string(),
    createdAt: v.number(),
  })
    .index("by_created_at", ["createdAt"])
    .index("by_user_created_at", ["userId", "createdAt"])
    .index("by_target_created_at", ["targetType", "targetId", "createdAt"]),

  workflowRuns: defineTable({
    workItemId: v.string(),
    phase: workflowPhaseValidator,
    status: workflowStatusValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_work_item_id", ["workItemId"])
    .index("by_work_item_created_at", ["workItemId", "createdAt"]),

  workflowEvents: defineTable({
    runId: v.id("workflowRuns"),
    kind: v.string(),
    payloadJson: v.string(),
    createdAt: v.number(),
  }).index("by_run_id", ["runId"]),
});
