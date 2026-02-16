import { and, eq } from "drizzle-orm";
import { db, ensureDbSchema, gateEvaluations, workItems } from "@workspace/db";

const GATES = ["decision", "time", "relationship", "impact", "watch"] as const;
type GateKey = (typeof GATES)[number];

export type MetricsSnapshot = {
  generatedAt: string;
  awaitingCount: number;
  completedCount: number;
  dismissedCount: number;
  interruptionPrecision: number;
  approvalRate: number;
  medianDecisionMinutes: number;
  gateHitCounts: Record<GateKey, number>;
};

function toMillis(value: unknown): number {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number") {
    return value;
  }

  return Date.now();
}

function toPercent(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 1000) / 10;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? 0;
  }

  const left = sorted[middle - 1] ?? 0;
  const right = sorted[middle] ?? 0;
  return Math.round(((left + right) / 2) * 10) / 10;
}

export async function getMetricsSnapshot(now = new Date()): Promise<MetricsSnapshot> {
  await ensureDbSchema();

  const rows = await db.select().from(workItems);

  let awaitingCount = 0;
  let completedCount = 0;
  let dismissedCount = 0;
  const decisionMinutes: number[] = [];

  for (const row of rows) {
    if (row.status === "awaiting_approval") {
      awaitingCount += 1;
    }

    if (row.status === "completed") {
      completedCount += 1;
    }

    if (row.status === "dismissed") {
      dismissedCount += 1;
    }

    if (row.status === "completed" || row.status === "dismissed") {
      const durationMs = toMillis(row.updatedAt) - toMillis(row.createdAt);
      decisionMinutes.push(Math.round((durationMs / 60000) * 10) / 10);
    }
  }

  const totalSurfaced = awaitingCount + completedCount + dismissedCount;
  const decisions = completedCount + dismissedCount;

  const gateHitCounts = Object.fromEntries(GATES.map((gate) => [gate, 0])) as Record<
    GateKey,
    number
  >;
  for (const gate of GATES) {
    const hits = await db
      .select({ id: gateEvaluations.id })
      .from(gateEvaluations)
      .where(and(eq(gateEvaluations.gate, gate), eq(gateEvaluations.matched, true)));
    gateHitCounts[gate] = hits.length;
  }

  return {
    generatedAt: now.toISOString(),
    awaitingCount,
    completedCount,
    dismissedCount,
    interruptionPrecision: toPercent(completedCount, decisions),
    approvalRate: toPercent(completedCount, totalSurfaced),
    medianDecisionMinutes: median(decisionMinutes),
    gateHitCounts,
  };
}
