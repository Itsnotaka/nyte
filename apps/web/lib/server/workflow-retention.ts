import { and, eq, inArray, lt } from "drizzle-orm";
import {
  db,
  ensureDbSchema,
  policyRules,
  users,
  workflowEvents,
  workflowRuns,
} from "@workspace/db";
import { recordAuditLog } from "./audit-log";

const DEFAULT_USER_ID = "local-user";
const DEFAULT_USER_EMAIL = "local-user@nyte.dev";
const DEFAULT_RETENTION_DAYS = 30;
const RETENTION_RULE_ID = "policy:workflow_retention_days";
let lastAutoPruneAt = 0;

async function ensureDefaultUser(now: Date) {
  await db
    .insert(users)
    .values({
      id: DEFAULT_USER_ID,
      email: DEFAULT_USER_EMAIL,
      name: "Local Nyte User",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        updatedAt: now,
      },
    });
}

export class WorkflowRetentionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowRetentionError";
  }
}

function normalizeDays(input: number) {
  if (!Number.isFinite(input) || input < 1 || input > 365) {
    throw new WorkflowRetentionError("Retention days must be between 1 and 365.");
  }

  return Math.floor(input);
}

export async function getWorkflowRetentionDays() {
  await ensureDbSchema();

  const envValue = process.env.NYTE_WORKFLOW_RETENTION_DAYS;
  if (envValue) {
    const parsed = Number(envValue);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 365) {
      return {
        days: Math.floor(parsed),
        source: "env" as const,
      };
    }
  }

  const rows = await db
    .select()
    .from(policyRules)
    .where(and(eq(policyRules.id, RETENTION_RULE_ID), eq(policyRules.enabled, true)))
    .limit(1);
  const row = rows.at(0);
  if (!row) {
    return {
      days: DEFAULT_RETENTION_DAYS,
      source: "default" as const,
    };
  }

  const parsed = Number(row.value);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 365) {
    return {
      days: DEFAULT_RETENTION_DAYS,
      source: "default" as const,
    };
  }

  return {
    days: Math.floor(parsed),
    source: "policy" as const,
  };
}

export async function setWorkflowRetentionDays(days: number, now = new Date()) {
  await ensureDbSchema();
  await ensureDefaultUser(now);
  const normalized = normalizeDays(days);

  await db
    .insert(policyRules)
    .values({
      id: RETENTION_RULE_ID,
      userId: DEFAULT_USER_ID,
      ruleType: "workflow_retention_days",
      value: String(normalized),
      enabled: true,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: policyRules.id,
      set: {
        value: String(normalized),
        enabled: true,
        updatedAt: now,
      },
    });

  await recordAuditLog({
    userId: DEFAULT_USER_ID,
    action: "workflow-retention.updated",
    targetType: "policy_rule",
    targetId: RETENTION_RULE_ID,
    payload: {
      days: normalized,
    },
    now,
  });

  return {
    days: normalized,
    source: "policy" as const,
  };
}

export async function pruneWorkflowHistory(now = new Date()) {
  await ensureDbSchema();
  const retention = await getWorkflowRetentionDays();
  const cutoff = new Date(now.getTime() - retention.days * 24 * 60 * 60 * 1000);

  const staleRuns = await db
    .select({ id: workflowRuns.id })
    .from(workflowRuns)
    .where(lt(workflowRuns.createdAt, cutoff));

  const staleIds = staleRuns.map((run) => run.id);
  if (staleIds.length > 0) {
    await db.delete(workflowEvents).where(inArray(workflowEvents.runId, staleIds));
    await db.delete(workflowRuns).where(inArray(workflowRuns.id, staleIds));
  }

  await recordAuditLog({
    userId: DEFAULT_USER_ID,
    action: "workflow-retention.pruned",
    targetType: "workflow",
    targetId: "runs",
    payload: {
      prunedRuns: staleIds.length,
      cutoff: cutoff.toISOString(),
      retentionDays: retention.days,
    },
    now,
  });

  return {
    retentionDays: retention.days,
    source: retention.source,
    prunedRuns: staleIds.length,
    cutoff: cutoff.toISOString(),
    performed: true as const,
    triggeredBy: "manual" as const,
  };
}

export async function pruneWorkflowHistoryIfDue(now = new Date(), intervalMs = 60 * 60 * 1000) {
  const nowMs = now.getTime();
  if (nowMs - lastAutoPruneAt < intervalMs) {
    return {
      retentionDays: null,
      source: null,
      prunedRuns: 0,
      cutoff: null,
      performed: false as const,
      triggeredBy: "auto" as const,
    };
  }

  const result = await pruneWorkflowHistory(now);
  lastAutoPruneAt = nowMs;
  return {
    ...result,
    triggeredBy: "auto" as const,
  };
}

export function resetWorkflowRetentionState() {
  lastAutoPruneAt = 0;
}
