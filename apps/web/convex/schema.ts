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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_work_item_id", ["workItemId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_status_updated", ["userId", "status", "updatedAt"]),

  ingestionState: defineTable({
    userId: v.string(),
    lastSyncedAt: v.number(),
  }).index("by_user_id", ["userId"]),

  feedbackEntries: defineTable({
    workItemId: v.string(),
    userId: v.string(),
    rating: v.union(v.literal("positive"), v.literal("negative")),
    note: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_work_item_id", ["workItemId"]),
});
