import { query } from "./_generated/server";
import { requireAuthUserId } from "./lib/auth";

export const runtimeMetrics = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const runs = await ctx.db
      .query("commandRuns")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(200);

    const total = runs.length;
    if (total === 0) {
      return {
        totalRuns: 0,
        clarificationRate: 0,
        approvalReadyRate: 0,
        highRiskRate: 0,
      };
    }

    const clarificationCount = runs.filter(
      (run) => run.status === "awaiting_follow_up"
    ).length;
    const approvalReadyCount = runs.filter(
      (run) => run.status === "awaiting_approval"
    ).length;
    const highRiskCount = runs.filter((run) => run.riskLevel === "high").length;

    return {
      totalRuns: total,
      clarificationRate: clarificationCount / total,
      approvalReadyRate: approvalReadyCount / total,
      highRiskRate: highRiskCount / total,
    };
  },
});

export const evalFixtures = query({
  args: {},
  handler: async () => {
    return [
      {
        id: "ambiguous-mention",
        input: "email @alex about onboarding",
        expected: "requires clarification when @alex unresolved",
      },
      {
        id: "refund-missing-amount",
        input: "refund this customer",
        expected: "requires clarification for missing amount",
      },
      {
        id: "calendar-with-attendee",
        input: "schedule a sync with sam tomorrow",
        expected: "calendar proposal with attendee",
      },
    ];
  },
});
