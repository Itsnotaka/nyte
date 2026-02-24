import { createToolCallPayload } from "@nyte/domain/actions";
import { toWorkItem, type IntakeSignal } from "@nyte/domain/triage";
import {
  classifyImportance,
  PI_RUNTIME_AI_MODELS,
  PI_RUNTIME_AI_PROVIDERS,
  type ImportanceTier,
} from "@nyte/extension-runtime";
import { ingestGoogleCalendarSignals } from "@nyte/integrations/calendar/ingestion";
import { ingestGmailSignals } from "@nyte/integrations/gmail/ingestion";
import type {
  FunctionReference,
  FunctionReturnType,
  OptionalRestArgs,
} from "convex/server";
import { v } from "convex/values";
import { log } from "evlog";

import "./evlog";
import { components, internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import { recordAuditLog } from "./audit";
import { requireAuthUserId } from "./lib/auth";
import { recordWorkItemRun } from "./runlog";

const STALE_AFTER_MS = 2 * 60 * 1000;
const MAX_CRON_USERS_PER_RUN = 200;
const MAX_SIGNALS_PER_PROVIDER = 40;
const IMPORTANCE_VERSION = "importance-v1";

type QueryRunner = {
  runQuery: <Query extends FunctionReference<"query", "public" | "internal">>(
    query: Query,
    ...args: OptionalRestArgs<Query>
  ) => Promise<FunctionReturnType<Query>>;
};

type IngestionStateSnapshot = {
  gmailCursor?: string | null;
  calendarCursor?: string | null;
  lastSyncedAt?: number | null;
  bootstrapCompletedAt?: number | null;
};

type PersistBatchResult = {
  insertedCount: number;
  updatedCount: number;
  queuedCount: number;
};

type RunForUserResult = {
  userId: string;
  reason: string;
  skipped: boolean;
  queuedCount: number;
  insertedCount: number;
  updatedCount: number;
  error: string | null;
};

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
  v.literal("gmail_sent"),
  v.literal("google_calendar"),
  v.literal("refund_queue")
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

const queuedItemValidator = v.object({
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
    v.literal("Send email"),
    v.literal("Create event"),
    v.literal("Queue refund")
  ),
  gates: v.array(gateValidator),
  preview: v.string(),
  priorityScore: v.number(),
  status: statusValidator,
  proposedAction: toolCallPayloadValidator,
  importanceTier: importanceTierValidator,
  importanceScore: v.number(),
  importanceReason: v.string(),
  importanceVersion: v.string(),
  classifiedAt: v.number(),
  actionStatus: actionStatusValidator,
  actionDestination: v.optional(actionDestinationValidator),
  providerReference: v.optional(v.string()),
  idempotencyKey: v.optional(v.string()),
  executedAt: v.optional(v.number()),
  actionError: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

type QueuedItemInput = {
  workItemId: string;
  userId: string;
  type: "draft" | "calendar" | "refund";
  source: "Gmail" | "Google Calendar";
  actor: string;
  summary: string;
  context: string;
  actionLabel: string;
  secondaryLabel: string;
  cta: "Send email" | "Create event" | "Queue refund";
  gates: Array<"decision" | "time" | "relationship" | "impact" | "watch">;
  preview: string;
  priorityScore: number;
  status: "awaiting_approval" | "completed" | "dismissed";
  proposedAction:
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
  importanceTier: "critical" | "important" | "later";
  importanceScore: number;
  importanceReason: string;
  importanceVersion: string;
  classifiedAt: number;
  actionStatus: "pending" | "executed" | "dismissed" | "failed";
  actionDestination?: "gmail_sent" | "google_calendar" | "refund_queue";
  providerReference?: string;
  idempotencyKey?: string;
  executedAt?: number;
  actionError?: string;
  createdAt: number;
  updatedAt: number;
};

type ImportanceClassification = {
  tier: ImportanceTier;
  score: number;
  reason: string;
  confidence: number;
  provider: string;
  model: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized.length > 0) {
      return normalized;
    }
  }
  return null;
}

function toRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value
      .map((entry) => asRecord(entry))
      .filter((entry): entry is Record<string, unknown> => entry !== null);
  }

  const record = asRecord(value);
  if (!record) {
    return [];
  }

  const candidates = [record.page, record.data, record.items];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate
        .map((entry) => asRecord(entry))
        .filter((entry): entry is Record<string, unknown> => entry !== null);
    }
  }

  return [];
}

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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  const record = asRecord(error);
  const message = asString(record?.message);
  if (message) {
    return message;
  }

  return "Unknown ingestion error";
}

function isStateFresh({
  lastSyncedAt,
  nowMs,
  staleAfterMs,
}: {
  lastSyncedAt?: number | null;
  nowMs: number;
  staleAfterMs: number;
}): boolean {
  if (!lastSyncedAt || !Number.isFinite(lastSyncedAt)) {
    return false;
  }

  return nowMs - lastSyncedAt < staleAfterMs;
}

async function listGoogleAccountUserIds(ctx: QueryRunner): Promise<string[]> {
  const result = await ctx.runQuery(components.betterAuth.adapter.findMany, {
    model: "account",
    where: [
      {
        field: "providerId",
        operator: "eq",
        value: "google",
      },
    ],
    paginationOpts: {
      numItems: 1000,
      cursor: null,
    },
  });

  const records = toRecordArray(result);
  const userIds = new Set<string>();

  for (const record of records) {
    const userId = asString(record.userId);
    if (userId) {
      userIds.add(userId);
    }
  }

  return [...userIds].slice(0, MAX_CRON_USERS_PER_RUN);
}

async function loadGoogleAccessToken(ctx: {
  userId: string;
  runQuery: QueryRunner["runQuery"];
}): Promise<string | null> {
  const result = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "account",
    where: [
      {
        field: "providerId",
        operator: "eq",
        value: "google",
      },
      {
        connector: "AND",
        field: "userId",
        operator: "eq",
        value: ctx.userId,
      },
    ],
  });

  const direct = asRecord(result);
  const directToken = asString(direct?.accessToken);
  if (directToken) {
    return directToken;
  }

  const nestedData = asRecord(direct?.data);
  const nestedToken = asString(nestedData?.accessToken);
  if (nestedToken) {
    return nestedToken;
  }

  if (Array.isArray(direct?.data)) {
    const first = asRecord(direct.data.at(0));
    const token = asString(first?.accessToken);
    if (token) {
      return token;
    }
  }

  return null;
}

export const getIngestionState = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("ingestionState")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

export const persistBatch = internalMutation({
  args: {
    userId: v.string(),
    now: v.number(),
    items: v.array(queuedItemValidator),
    state: v.object({
      gmailCursor: v.optional(v.union(v.null(), v.string())),
      calendarCursor: v.optional(v.union(v.null(), v.string())),
      lastError: v.optional(v.union(v.null(), v.string())),
      markSynced: v.boolean(),
    }),
  },
  handler: async (ctx, args): Promise<PersistBatchResult> => {
    log.info({
      event: "ingestion.persistBatch.start",
      userId: args.userId,
      itemCount: args.items.length,
      markSynced: args.state.markSynced,
    });

    const existingState = await ctx.db
      .query("ingestionState")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();

    const bootstrapCompletedAt =
      existingState?.bootstrapCompletedAt ??
      (args.state.markSynced ? args.now : null);

    if (existingState) {
      await ctx.db.patch(existingState._id, {
        gmailCursor: args.state.gmailCursor,
        calendarCursor: args.state.calendarCursor,
        lastSyncedAt: args.state.markSynced
          ? args.now
          : (existingState.lastSyncedAt ?? null),
        bootstrapCompletedAt,
        lastError: args.state.lastError ?? null,
        updatedAt: args.now,
      });
    } else {
      await ctx.db.insert("ingestionState", {
        userId: args.userId,
        gmailCursor: args.state.gmailCursor,
        calendarCursor: args.state.calendarCursor,
        lastSyncedAt: args.state.markSynced ? args.now : null,
        bootstrapCompletedAt,
        lastError: args.state.lastError ?? null,
        createdAt: args.now,
        updatedAt: args.now,
      });
    }

    let insertedCount = 0;
    let updatedCount = 0;

    for (const item of args.items) {
      const existingItem = await ctx.db
        .query("queueItems")
        .withIndex("by_work_item_id", (q) =>
          q.eq("workItemId", item.workItemId)
        )
        .unique();

      if (!existingItem) {
        await ctx.db.insert("queueItems", item);
        insertedCount += 1;
      } else {
        const isTerminal =
          existingItem.status === "completed" ||
          existingItem.status === "dismissed";

        await ctx.db.patch(existingItem._id, {
          ...item,
          status: isTerminal ? existingItem.status : item.status,
          actionStatus:
            existingItem.actionStatus === "executed"
              ? existingItem.actionStatus
              : item.actionStatus,
          actionDestination:
            existingItem.actionStatus === "executed"
              ? existingItem.actionDestination
              : item.actionDestination,
          providerReference:
            existingItem.actionStatus === "executed"
              ? existingItem.providerReference
              : item.providerReference,
          idempotencyKey:
            existingItem.actionStatus === "executed"
              ? existingItem.idempotencyKey
              : item.idempotencyKey,
          executedAt:
            existingItem.actionStatus === "executed"
              ? existingItem.executedAt
              : item.executedAt,
          actionError:
            existingItem.actionStatus === "executed"
              ? existingItem.actionError
              : item.actionError,
          createdAt: existingItem.createdAt,
          updatedAt: args.now,
        });
        updatedCount += 1;
      }

      await recordWorkItemRun(ctx, {
        workItemId: item.workItemId,
        phase: "ingest",
        status: "completed",
        now: args.now,
        events: [
          {
            kind: "signal.persisted",
            payload: {
              source: item.source,
              actor: item.actor,
            },
          },
          {
            kind: "importance.classified",
            payload: {
              tier: item.importanceTier,
              score: item.importanceScore,
            },
          },
        ],
      });

      await recordAuditLog(ctx, {
        userId: args.userId,
        action: "work-item.ingested",
        targetType: "work_item",
        targetId: item.workItemId,
        payload: {
          source: item.source,
          priorityScore: item.priorityScore,
          importanceTier: item.importanceTier,
          importanceScore: item.importanceScore,
        },
        now: args.now,
      });
    }

    const result = {
      insertedCount,
      updatedCount,
      queuedCount: args.items.length,
    };

    log.info({
      event: "ingestion.persistBatch.complete",
      userId: args.userId,
      insertedCount: result.insertedCount,
      updatedCount: result.updatedCount,
      queuedCount: result.queuedCount,
    });

    return result;
  },
});

export const runForUser = internalAction({
  args: {
    userId: v.string(),
    force: v.optional(v.boolean()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<RunForUserResult> => {
    log.info({
      event: "ingestion.runForUser.start",
      userId: args.userId,
      force: args.force ?? false,
      reason: args.reason ?? "manual",
    });

    const nowMs = Date.now();
    const nowDate = new Date(nowMs);
    const force = args.force ?? false;
    const state: IngestionStateSnapshot | null = await ctx.runQuery(
      internal.ingestion.getIngestionState,
      {
        userId: args.userId,
      }
    );

    if (
      !force &&
      state?.bootstrapCompletedAt &&
      isStateFresh({
        lastSyncedAt: state.lastSyncedAt,
        nowMs,
        staleAfterMs: STALE_AFTER_MS,
      })
    ) {
      const result = {
        userId: args.userId,
        reason: args.reason ?? "manual",
        skipped: true,
        queuedCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        error: null,
      };
      log.info({
        event: "ingestion.runForUser.skipped",
        ...result,
      });
      return result;
    }

    const accessToken = await loadGoogleAccessToken({
      userId: args.userId,
      runQuery: (query, ...queryArgs) => ctx.runQuery(query, ...queryArgs),
    });

    if (!accessToken) {
      const message = "Missing Google access token for user.";
      await ctx.runMutation(internal.ingestion.persistBatch, {
        userId: args.userId,
        now: nowMs,
        items: [],
        state: {
          gmailCursor: state?.gmailCursor ?? null,
          calendarCursor: state?.calendarCursor ?? null,
          lastError: message,
          markSynced: false,
        },
      });

      const result = {
        userId: args.userId,
        reason: args.reason ?? "manual",
        skipped: false,
        queuedCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        error: message,
      };
      log.info({
        event: "ingestion.runForUser.missingAccessToken",
        ...result,
      });
      return result;
    }

    const [gmailResult, calendarResult] = await Promise.allSettled([
      ingestGmailSignals({
        accessToken,
        cursor: state?.gmailCursor ?? undefined,
        now: nowDate,
        watchKeywords: [],
        maxResults: MAX_SIGNALS_PER_PROVIDER,
      }),
      ingestGoogleCalendarSignals({
        accessToken,
        cursor: state?.calendarCursor ?? undefined,
        now: nowDate,
        watchKeywords: [],
        maxResults: MAX_SIGNALS_PER_PROVIDER,
      }),
    ]);

    if (
      gmailResult.status === "rejected" &&
      calendarResult.status === "rejected"
    ) {
      const message = `gmail:${getErrorMessage(gmailResult.reason)} | calendar:${getErrorMessage(calendarResult.reason)}`;
      await ctx.runMutation(internal.ingestion.persistBatch, {
        userId: args.userId,
        now: nowMs,
        items: [],
        state: {
          gmailCursor: state?.gmailCursor ?? null,
          calendarCursor: state?.calendarCursor ?? null,
          lastError: message,
          markSynced: false,
        },
      });

      const result = {
        userId: args.userId,
        reason: args.reason ?? "manual",
        skipped: false,
        queuedCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        error: message,
      };
      log.info({
        event: "ingestion.runForUser.providersRejected",
        ...result,
      });
      return result;
    }

    const signals = [
      ...(gmailResult.status === "fulfilled" ? gmailResult.value.signals : []),
      ...(calendarResult.status === "fulfilled"
        ? calendarResult.value.signals
        : []),
    ];

    const queuedItems: QueuedItemInput[] = [];
    for (const signal of signals) {
      const workItem = toWorkItem(signal, nowDate);
      if (!workItem) {
        continue;
      }

      const importance = await classifySignalImportance(signal, nowDate);
      const proposedAction = createToolCallPayload(workItem);
      const priorityScore = Math.max(workItem.priorityScore, importance.score);

      queuedItems.push({
        workItemId: workItem.id,
        userId: args.userId,
        type: workItem.type,
        source: workItem.source,
        actor: workItem.actor,
        summary: workItem.summary,
        context: workItem.context,
        actionLabel: workItem.actionLabel,
        secondaryLabel: workItem.secondaryLabel,
        cta: workItem.cta,
        gates: workItem.gates,
        preview: workItem.preview,
        priorityScore,
        status: "awaiting_approval",
        proposedAction,
        importanceTier: importance.tier,
        importanceScore: importance.score,
        importanceReason: importance.reason,
        importanceVersion: IMPORTANCE_VERSION,
        classifiedAt: nowMs,
        actionStatus: "pending",
        createdAt: nowMs,
        updatedAt: nowMs,
      });
    }

    const nextGmailCursor =
      gmailResult.status === "fulfilled"
        ? gmailResult.value.nextCursor
        : (state?.gmailCursor ?? null);
    const nextCalendarCursor =
      calendarResult.status === "fulfilled"
        ? calendarResult.value.nextCursor
        : (state?.calendarCursor ?? null);
    const partialError =
      gmailResult.status === "rejected"
        ? `gmail:${getErrorMessage(gmailResult.reason)}`
        : calendarResult.status === "rejected"
          ? `calendar:${getErrorMessage(calendarResult.reason)}`
          : null;

    const persisted = await ctx.runMutation(internal.ingestion.persistBatch, {
      userId: args.userId,
      now: nowMs,
      items: queuedItems,
      state: {
        gmailCursor: nextGmailCursor,
        calendarCursor: nextCalendarCursor,
        lastError: partialError,
        markSynced: true,
      },
    });

    const result = {
      userId: args.userId,
      reason: args.reason ?? "manual",
      skipped: false,
      queuedCount: persisted.queuedCount,
      insertedCount: persisted.insertedCount,
      updatedCount: persisted.updatedCount,
      error: partialError ?? null,
    };
    log.info({
      event: "ingestion.runForUser.complete",
      ...result,
      signalCount: signals.length,
    });
    return result;
  },
});

export const enqueueCronIngestion = internalAction({
  args: {},
  handler: async (ctx): Promise<{ scheduledCount: number }> => {
    log.info({
      event: "ingestion.enqueueCronIngestion.start",
      maxUsersPerRun: MAX_CRON_USERS_PER_RUN,
    });

    const userIds = await listGoogleAccountUserIds({
      runQuery: (query, ...queryArgs) => ctx.runQuery(query, ...queryArgs),
    });

    for (const userId of userIds) {
      await ctx.scheduler.runAfter(0, internal.ingestion.runForUser, {
        userId,
        reason: "cron",
      });
    }

    const result = {
      scheduledCount: userIds.length,
    };
    log.info({
      event: "ingestion.enqueueCronIngestion.complete",
      scheduledCount: result.scheduledCount,
    });
    return result;
  },
});

export const syncMine = mutation({
  args: {
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId: string = await requireAuthUserId(ctx);
    log.info({
      event: "ingestion.syncMine.start",
      userId,
      force: args.force ?? false,
    });
    await ctx.scheduler.runAfter(0, internal.ingestion.runForUser, {
      userId,
      force: args.force ?? false,
      reason: "manual",
    });

    log.info({
      event: "ingestion.syncMine.queued",
      userId,
    });
    return { queued: true };
  },
});
