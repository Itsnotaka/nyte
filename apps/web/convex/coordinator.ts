import { v } from "convex/values";

import { internalQuery } from "./_generated/server";

export const delegate = internalQuery({
  args: {
    kind: v.union(
      v.literal("gmail.createDraft"),
      v.literal("google-calendar.createEvent"),
      v.literal("billing.queueRefund")
    ),
    message: v.string(),
  },
  handler: async (_ctx, args) => {
    if (args.kind === "google-calendar.createEvent") {
      return {
        manager: "coordinator",
        worker: "calendar-worker",
        confidence: 0.88,
        objective: "Prepare scheduling proposal with attendee resolution.",
      };
    }

    if (args.kind === "billing.queueRefund") {
      return {
        manager: "coordinator",
        worker: "billing-worker",
        confidence: 0.92,
        objective: "Prepare refund proposal with safe confirmation policy.",
      };
    }

    return {
      manager: "coordinator",
      worker: "gmail-worker",
      confidence: 0.9,
      objective: "Prepare concise email draft proposal.",
    };
  },
});
