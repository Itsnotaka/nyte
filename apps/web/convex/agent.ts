import type { RuntimePromptPart } from "@nyte/domain";
import { isToolCallPayload, type ToolCallPayload } from "@nyte/domain/actions";
import { executeProposedAction } from "@nyte/domain/execution";
import {
  executeExtension,
  EXTENSION_AUTH_PROVIDERS,
  EXTENSION_AUTH_SCOPES,
  EXTENSION_AUDIT_SOURCES,
  EXTENSION_NAMES,
  interpretCommandTurn,
  type ExtensionRequest,
  type RuntimeCommandProposal,
  type RuntimeConversationTurn,
} from "@nyte/extension-runtime";
import { ConvexError, v } from "convex/values";
import { createRequestLogger } from "evlog";
import { nanoid } from "nanoid";

import "./evlog";
import { internal } from "./_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { recordAuditLog } from "./audit";
import { requireAuthUserId } from "./lib/auth";
import { recordWorkItemRun } from "./runlog";

const promptPartValidator = v.union(
  v.object({
    type: v.literal("text"),
    text: v.string(),
  }),
  v.object({
    type: v.literal("contact"),
    email: v.string(),
    display: v.string(),
    contactId: v.optional(v.string()),
  }),
  v.object({
    type: v.literal("file"),
    path: v.string(),
    display: v.optional(v.string()),
  })
);
const triggerTypeValidator = v.union(
  v.literal("manual"),
  v.literal("event"),
  v.literal("schedule")
);
const runStatusValidator = v.union(
  v.literal("awaiting_follow_up"),
  v.literal("awaiting_approval"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("cancelled")
);
const riskLevelValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high")
);

type PromptPart = RuntimePromptPart;

type RetrievalHit = {
  sourceType: string;
  sourceId: string;
  summary: string;
  score: number;
  whyRelevant: string;
};

type InlineExecution = {
  destination: "gmail_sent" | "google_calendar" | "refund_queue";
  providerReference: string;
  idempotencyKey: string;
  executedAt: number;
};

function createRunId(now: number): string {
  return `run:${now}:${nanoid(10)}`;
}

function normalizeMessage(message: string): string {
  return message.trim().replace(/\s+/g, " ").slice(0, 5000);
}

function parsePromptParts(
  parts: PromptPart[] | undefined,
  message: string
): PromptPart[] {
  if (!parts || parts.length === 0) {
    return [{ type: "text", text: message }];
  }
  return parts;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toExecutionTimestamp(value: string, fallback: number): number {
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return fallback;
}

function proposalPresentation(
  payload: ToolCallPayload
): Pick<
  RuntimeCommandProposal,
  "type" | "source" | "actionLabel" | "secondaryLabel" | "cta"
> {
  if (payload.kind === "google-calendar.createEvent") {
    return {
      type: "calendar",
      source: "Google Calendar",
      actionLabel: "Review event details",
      secondaryLabel: "Dismiss",
      cta: "Create event",
    };
  }

  if (payload.kind === "billing.queueRefund") {
    return {
      type: "refund",
      source: "Gmail",
      actionLabel: "Review refund details",
      secondaryLabel: "Dismiss",
      cta: "Queue refund",
    };
  }

  return {
    type: "draft",
    source: "Gmail",
    actionLabel: "Review email before sending",
    secondaryLabel: "Dismiss",
    cta: "Send email",
  };
}

function parseStoredProposal(proposalJson: string): RuntimeCommandProposal {
  const parsed = asRecord(JSON.parse(proposalJson));
  if (!parsed) {
    throw new ConvexError("Stored proposal is invalid.");
  }

  const summary = asNonEmptyString(parsed.summary);
  const preview = asNonEmptyString(parsed.preview);
  const context =
    asNonEmptyString(parsed.context) ??
    "Generated from inline command conversation.";
  const suggestionText = asNonEmptyString(parsed.suggestionText);
  const riskLevel = parsed.riskLevel;
  const payload = parsed.payload;
  const suggestedContactEmail = asNonEmptyString(parsed.suggestedContactEmail);

  if (
    !summary ||
    !preview ||
    !suggestionText ||
    (riskLevel !== "low" && riskLevel !== "medium" && riskLevel !== "high") ||
    !isToolCallPayload(payload)
  ) {
    throw new ConvexError("Stored proposal is incomplete.");
  }

  const presentation = proposalPresentation(payload);
  return {
    ...presentation,
    summary,
    preview,
    context,
    suggestionText,
    riskLevel,
    payload,
    suggestedContactEmail: suggestedContactEmail ?? undefined,
  };
}

function parseStoredConversation(
  conversationJson: string
): RuntimeConversationTurn[] {
  const parsed: unknown = JSON.parse(conversationJson);
  if (!Array.isArray(parsed)) {
    throw new ConvexError("Stored conversation is invalid.");
  }

  const turns: RuntimeConversationTurn[] = [];
  for (const entry of parsed) {
    const record = asRecord(entry);
    const role = record?.role;
    const text = asNonEmptyString(record?.text);
    const createdAt = asNumber(record?.createdAt);
    if (
      (role !== "user" && role !== "assistant") ||
      !text ||
      createdAt === null
    ) {
      throw new ConvexError("Stored conversation is malformed.");
    }
    turns.push({
      role,
      text,
      createdAt,
    });
  }

  return turns;
}

function parseStoredExecution(executionJson: string): InlineExecution | null {
  const parsed = asRecord(JSON.parse(executionJson));
  if (!parsed) {
    return null;
  }

  const destination = parsed.destination;
  const providerReference = asNonEmptyString(parsed.providerReference);
  const idempotencyKey = asNonEmptyString(parsed.idempotencyKey);
  const executedAt = asNumber(parsed.executedAt);
  if (
    (destination !== "gmail_sent" &&
      destination !== "google_calendar" &&
      destination !== "refund_queue") ||
    !providerReference ||
    !idempotencyKey ||
    executedAt === null
  ) {
    return null;
  }

  return {
    destination,
    providerReference,
    idempotencyKey,
    executedAt,
  };
}

function emailDisplayFromEmail(email: string): string {
  const localPart = email.split("@")[0];
  return localPart || email;
}

function contactListFromPayload(payload: ToolCallPayload): Array<{
  email: string;
  display: string;
}> {
  const emails = new Set<string>();
  if (payload.kind === "gmail.createDraft") {
    for (const email of payload.to) {
      emails.add(email.toLowerCase());
    }
  } else if (payload.kind === "google-calendar.createEvent") {
    for (const email of payload.attendees) {
      emails.add(email.toLowerCase());
    }
  } else if (payload.customerName.includes("@")) {
    emails.add(payload.customerName.toLowerCase());
  }

  return [...emails].map((email) => ({
    email,
    display: emailDisplayFromEmail(email),
  }));
}

function extensionRequestForPayload(args: {
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
  runId: string;
  idempotencyKey: string;
}): ExtensionRequest {
  if (args.payload.kind === "gmail.createDraft") {
    return {
      name: EXTENSION_NAMES.gmailSend,
      auth: {
        provider: EXTENSION_AUTH_PROVIDERS.google,
        userId: args.userId,
        scopes: [...EXTENSION_AUTH_SCOPES.googleWorkspace],
      },
      idempotencyKey: args.idempotencyKey,
      audit: {
        workItemId: args.runId,
        actionId: `${args.runId}:action`,
        source: EXTENSION_AUDIT_SOURCES.decisionQueue,
      },
      input: args.payload,
    };
  }

  return {
    name: EXTENSION_NAMES.calendarCreateEvent,
    auth: {
      provider: EXTENSION_AUTH_PROVIDERS.google,
      userId: args.userId,
      scopes: [...EXTENSION_AUTH_SCOPES.googleWorkspace],
    },
    idempotencyKey: args.idempotencyKey,
    audit: {
      workItemId: args.runId,
      actionId: `${args.runId}:action`,
      source: EXTENSION_AUDIT_SOURCES.decisionQueue,
    },
    input: args.payload,
  };
}

async function executeInlinePayload(args: {
  payload: ToolCallPayload;
  userId: string;
  runId: string;
  now: number;
  idempotencyKey: string;
}): Promise<InlineExecution> {
  if (args.payload.kind === "billing.queueRefund") {
    const execution = executeProposedAction(args.payload, new Date(args.now), {
      idempotencyKey: args.idempotencyKey,
    });
    return {
      destination: execution.destination,
      providerReference: execution.providerReference,
      idempotencyKey: execution.idempotencyKey,
      executedAt: toExecutionTimestamp(execution.executedAt, args.now),
    };
  }

  const extensionResult = await executeExtension(
    extensionRequestForPayload({
      payload: args.payload,
      userId: args.userId,
      runId: args.runId,
      idempotencyKey: args.idempotencyKey,
    })
  );

  if (extensionResult.name === EXTENSION_NAMES.gmailSend) {
    return {
      destination: "gmail_sent",
      providerReference: extensionResult.output.providerMessageId,
      idempotencyKey: extensionResult.idempotencyKey,
      executedAt: toExecutionTimestamp(extensionResult.executedAt, args.now),
    };
  }

  if (extensionResult.name === EXTENSION_NAMES.calendarCreateEvent) {
    return {
      destination: "google_calendar",
      providerReference: extensionResult.output.providerEventId,
      idempotencyKey: extensionResult.idempotencyKey,
      executedAt: toExecutionTimestamp(extensionResult.executedAt, args.now),
    };
  }

  throw new ConvexError("Unsupported extension result.");
}

export const getRunForUser = internalQuery({
  args: {
    runId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query("commandRuns")
      .withIndex("by_run_id", (q) => q.eq("runId", args.runId))
      .unique();
    if (!run || run.userId !== args.userId) {
      return null;
    }
    return run;
  },
});

export const storePreviewRun = internalMutation({
  args: {
    runId: v.string(),
    userId: v.string(),
    inputText: v.string(),
    status: runStatusValidator,
    proposalJson: v.string(),
    retrievalHitsJson: v.string(),
    conversationJson: v.string(),
    suggestionText: v.string(),
    riskLevel: riskLevelValidator,
    followUpQuestion: v.optional(v.string()),
    triggerType: triggerTypeValidator,
    retrievalHitCount: v.number(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("commandRuns", {
      runId: args.runId,
      userId: args.userId,
      inputText: args.inputText,
      status: args.status,
      proposalJson: args.proposalJson,
      retrievalHitsJson: args.retrievalHitsJson,
      conversationJson: args.conversationJson,
      followUpQuestion: args.followUpQuestion,
      suggestionText: args.suggestionText,
      riskLevel: args.riskLevel,
      triggerType: args.triggerType,
      createdAt: args.now,
      updatedAt: args.now,
    });

    await recordWorkItemRun(ctx, {
      workItemId: args.runId,
      phase: "ingest",
      status: "completed",
      now: args.now,
      events: [
        {
          kind: "runtime.preview.created",
          payload: {
            status: args.status,
            riskLevel: args.riskLevel,
            followUpQuestion: args.followUpQuestion ?? null,
          },
        },
      ],
    });

    await recordAuditLog(ctx, {
      userId: args.userId,
      action: "agent.preview",
      targetType: "command_run",
      targetId: args.runId,
      payload: {
        triggerType: args.triggerType,
        status: args.status,
        riskLevel: args.riskLevel,
        retrievalHitCount: args.retrievalHitCount,
      },
      now: args.now,
    });
  },
});

export const updateRunTurn = internalMutation({
  args: {
    runId: v.string(),
    userId: v.string(),
    status: runStatusValidator,
    proposalJson: v.string(),
    retrievalHitsJson: v.string(),
    conversationJson: v.string(),
    suggestionText: v.string(),
    riskLevel: riskLevelValidator,
    followUpQuestion: v.optional(v.string()),
    retrievalHitCount: v.number(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query("commandRuns")
      .withIndex("by_run_id", (q) => q.eq("runId", args.runId))
      .unique();
    if (!run || run.userId !== args.userId) {
      throw new ConvexError("Run not found.");
    }

    await ctx.db.patch(run._id, {
      status: args.status,
      proposalJson: args.proposalJson,
      retrievalHitsJson: args.retrievalHitsJson,
      conversationJson: args.conversationJson,
      followUpQuestion: args.followUpQuestion,
      suggestionText: args.suggestionText,
      riskLevel: args.riskLevel,
      lastError: undefined,
      updatedAt: args.now,
    });

    await recordWorkItemRun(ctx, {
      workItemId: args.runId,
      phase: "ingest",
      status: "completed",
      now: args.now,
      events: [
        {
          kind: "runtime.turn.updated",
          payload: {
            status: args.status,
            followUpQuestion: args.followUpQuestion ?? null,
            retrievalHitCount: args.retrievalHitCount,
          },
        },
      ],
    });

    await recordAuditLog(ctx, {
      userId: args.userId,
      action: "agent.respond",
      targetType: "command_run",
      targetId: args.runId,
      payload: {
        status: args.status,
        riskLevel: args.riskLevel,
        retrievalHitCount: args.retrievalHitCount,
      },
      now: args.now,
    });
  },
});

async function confirmRunById(args: {
  ctx: MutationCtx;
  userId: string;
  runId: string;
}) {
  const run = await args.ctx.db
    .query("commandRuns")
    .withIndex("by_run_id", (q) => q.eq("runId", args.runId))
    .unique();

  if (!run || run.userId !== args.userId) {
    throw new ConvexError("Run not found.");
  }

  if (run.status === "completed" && run.executionJson) {
    const execution = parseStoredExecution(run.executionJson);
    if (execution) {
      return {
        runId: args.runId,
        idempotent: true,
        execution,
      };
    }
  }

  if (run.status === "awaiting_follow_up") {
    throw new ConvexError(
      run.followUpQuestion ?? "Resolve follow-up before confirming."
    );
  }

  if (run.status !== "awaiting_approval") {
    throw new ConvexError("Run is not ready for confirmation.");
  }

  const proposal = parseStoredProposal(run.proposalJson);
  const now = Date.now();
  const idempotencyKey = `run_${nanoid(12)}`;

  try {
    const execution = await executeInlinePayload({
      payload: proposal.payload,
      userId: args.userId,
      runId: args.runId,
      now,
      idempotencyKey,
    });

    await args.ctx.db.patch(run._id, {
      status: "completed",
      executionJson: JSON.stringify(execution),
      followUpQuestion: undefined,
      lastError: undefined,
      updatedAt: now,
    });

    const contacts = contactListFromPayload(proposal.payload);
    if (contacts.length > 0) {
      await args.ctx.runMutation(internal.contacts.upsertMany, {
        userId: args.userId,
        contacts,
      });
    }

    await args.ctx.runMutation(internal.retrieval.upsertKnowledge, {
      userId: args.userId,
      sourceType: "workflow_event",
      sourceId: `${args.runId}:confirm:${now}`,
      summary: `Confirmed ${proposal.payload.kind} from inline command`,
      metadataJson: JSON.stringify({
        runId: args.runId,
        destination: execution.destination,
      }),
    });

    await recordWorkItemRun(args.ctx, {
      workItemId: args.runId,
      phase: "approve",
      status: "completed",
      now,
      events: [
        {
          kind: "runtime.confirmed",
          payload: {
            actionKind: proposal.payload.kind,
            destination: execution.destination,
          },
        },
      ],
    });

    await recordAuditLog(args.ctx, {
      userId: args.userId,
      action: "agent.confirm",
      targetType: "command_run",
      targetId: args.runId,
      payload: {
        destination: execution.destination,
        providerReference: execution.providerReference,
        idempotencyKey: execution.idempotencyKey,
      },
      now,
    });

    return {
      runId: args.runId,
      idempotent: false,
      execution,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "Unable to execute command approval.";

    await args.ctx.db.patch(run._id, {
      status: "failed",
      lastError: message,
      updatedAt: now,
    });

    await recordWorkItemRun(args.ctx, {
      workItemId: args.runId,
      phase: "approve",
      status: "failed",
      now,
      events: [
        {
          kind: "runtime.confirm.failed",
          payload: { message },
        },
      ],
    });

    await recordAuditLog(args.ctx, {
      userId: args.userId,
      action: "agent.confirm.failed",
      targetType: "command_run",
      targetId: args.runId,
      payload: { message },
      now,
    });

    throw new ConvexError(message);
  }
}

export const preview = action({
  args: {
    message: v.string(),
    parts: v.optional(v.array(promptPartValidator)),
    triggerType: v.optional(triggerTypeValidator),
  },
  handler: async (ctx, args) => {
    const log = createRequestLogger({
      method: "mutation",
      path: "agent/preview",
    });

    try {
      const userId = await requireAuthUserId(ctx);
      const message = normalizeMessage(args.message);
      if (message.length === 0) {
        throw new Error("Message is required.");
      }

      const parts = parsePromptParts(args.parts, message);
      const triggerType = args.triggerType ?? "manual";
      const now = Date.now();

      const retrievalHits = (await ctx.runAction(
        internal.retrieval.retrieveContextForCommand,
        {
          userId,
          queryText: message,
          limit: 8,
        }
      )) as RetrievalHit[];

      const conversation: RuntimeConversationTurn[] = [
        { role: "user", text: message, createdAt: now },
      ];

      const turn = await interpretCommandTurn({
        message,
        parts,
        retrievalHits,
        conversation,
      });

      if (turn.followUpQuestion) {
        conversation.push({
          role: "assistant",
          text: turn.followUpQuestion,
          createdAt: now,
        });
      }

      const runId = createRunId(now);

      await ctx.runMutation(internal.agent.storePreviewRun, {
        runId,
        userId,
        inputText: message,
        status: turn.status,
        proposalJson: JSON.stringify(turn.proposal),
        retrievalHitsJson: JSON.stringify(turn.retrievalHits),
        conversationJson: JSON.stringify(conversation),
        suggestionText: turn.proposal.suggestionText,
        riskLevel: turn.proposal.riskLevel,
        followUpQuestion: turn.followUpQuestion,
        triggerType,
        retrievalHitCount: turn.retrievalHits.length,
        now,
      });

      log.set({
        userId,
        runId,
        runStatus: turn.status,
        riskLevel: turn.proposal.riskLevel,
      });

      return {
        runId,
        status: turn.status,
        followUpQuestion: turn.followUpQuestion,
        proposal: turn.proposal,
        retrievalHits: turn.retrievalHits,
      };
    } finally {
      log.emit();
    }
  },
});

export const respond = action({
  args: {
    runId: v.string(),
    message: v.string(),
    parts: v.optional(v.array(promptPartValidator)),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const message = normalizeMessage(args.message);
    if (message.length === 0) {
      throw new ConvexError("Message is required.");
    }

    const existingRun = await ctx.runQuery(internal.agent.getRunForUser, {
      runId: args.runId,
      userId,
    });
    if (!existingRun) {
      throw new ConvexError("Run not found.");
    }
    if (
      existingRun.status === "completed" ||
      existingRun.status === "failed" ||
      existingRun.status === "cancelled"
    ) {
      throw new ConvexError("Run is no longer editable.");
    }

    const now = Date.now();
    const parts = parsePromptParts(args.parts, message);
    const previousProposal = parseStoredProposal(existingRun.proposalJson);
    const previousConversation = parseStoredConversation(
      existingRun.conversationJson
    );

    const retrievalHits = (await ctx.runAction(
      internal.retrieval.retrieveContextForCommand,
      {
        userId,
        queryText: message,
        limit: 8,
      }
    )) as RetrievalHit[];

    const conversation: RuntimeConversationTurn[] = [
      ...previousConversation,
      {
        role: "user",
        text: message,
        createdAt: now,
      },
    ];

    const turn = await interpretCommandTurn({
      message,
      parts,
      retrievalHits,
      conversation,
      previousProposal,
    });

    if (turn.followUpQuestion) {
      conversation.push({
        role: "assistant",
        text: turn.followUpQuestion,
        createdAt: now,
      });
    }

    await ctx.runMutation(internal.agent.updateRunTurn, {
      runId: args.runId,
      userId,
      status: turn.status,
      proposalJson: JSON.stringify(turn.proposal),
      retrievalHitsJson: JSON.stringify(turn.retrievalHits),
      conversationJson: JSON.stringify(conversation),
      suggestionText: turn.proposal.suggestionText,
      riskLevel: turn.proposal.riskLevel,
      followUpQuestion: turn.followUpQuestion,
      retrievalHitCount: turn.retrievalHits.length,
      now,
    });

    return {
      runId: args.runId,
      status: turn.status,
      followUpQuestion: turn.followUpQuestion,
      proposal: turn.proposal,
      retrievalHits: turn.retrievalHits,
    };
  },
});

export const confirm = mutation({
  args: {
    runId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    return confirmRunById({
      ctx,
      userId,
      runId: args.runId,
    });
  },
});

export const run = mutation({
  args: {
    message: v.string(),
    parts: v.optional(v.array(promptPartValidator)),
  },
  handler: async () => {
    throw new ConvexError(
      "agent.run is deprecated. Use preview/respond/confirm inline flow."
    );
  },
});

export const recentRuns = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
    const rows = await ctx.db
      .query("commandRuns")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return rows.map((row) => ({
      runId: row.runId,
      inputText: row.inputText,
      status: row.status,
      riskLevel: row.riskLevel,
      followUpQuestion: row.followUpQuestion,
      lastError: row.lastError,
      updatedAt: row.updatedAt,
    }));
  },
});
