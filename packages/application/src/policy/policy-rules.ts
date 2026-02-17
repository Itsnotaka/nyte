import { db, ensureDbSchema, policyRules } from "@nyte/db";
import { and, desc, eq } from "@nyte/db/drizzle";

import { recordAuditLog } from "../audit/audit-log";
import { DEFAULT_USER_ID, ensureDefaultUser } from "../shared/default-user";

export class PolicyRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyRuleError";
  }
}

function normalizeKeyword(keyword: string) {
  return keyword.trim().toLowerCase();
}

export async function listWatchKeywords() {
  await ensureDbSchema();
  const rows = await db
    .select()
    .from(policyRules)
    .where(and(eq(policyRules.userId, DEFAULT_USER_ID), eq(policyRules.ruleType, "watch_keyword")))
    .orderBy(desc(policyRules.updatedAt));

  return rows.filter((row) => row.enabled).map((row) => row.value);
}

export async function addWatchKeyword(keyword: string, now = new Date()) {
  await ensureDbSchema();
  await ensureDefaultUser(now);

  const normalized = normalizeKeyword(keyword);
  if (!normalized) {
    throw new PolicyRuleError("Keyword cannot be empty.");
  }

  await db
    .insert(policyRules)
    .values({
      id: `watch:${normalized}`,
      userId: DEFAULT_USER_ID,
      ruleType: "watch_keyword",
      value: normalized,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: policyRules.id,
      set: {
        value: normalized,
        enabled: true,
        updatedAt: now,
      },
    });

  await recordAuditLog({
    userId: DEFAULT_USER_ID,
    action: "policy.watch-keyword.added",
    targetType: "policy_rule",
    targetId: `watch:${normalized}`,
    payload: {
      keyword: normalized,
    },
    now,
  });

  return normalized;
}

export async function removeWatchKeyword(keyword: string) {
  await ensureDbSchema();

  const normalized = normalizeKeyword(keyword);
  if (!normalized) {
    throw new PolicyRuleError("Keyword cannot be empty.");
  }

  await db.delete(policyRules).where(eq(policyRules.id, `watch:${normalized}`));
  await recordAuditLog({
    userId: DEFAULT_USER_ID,
    action: "policy.watch-keyword.removed",
    targetType: "policy_rule",
    targetId: `watch:${normalized}`,
    payload: {
      keyword: normalized,
    },
  });
  return normalized;
}
