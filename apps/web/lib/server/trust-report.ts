import { getGoogleConnectionStatus } from "./connections";
import { getMetricsSnapshot } from "./metrics";
import { listWatchKeywords } from "./policy-rules";
import { getWorkflowRetentionDays } from "./workflow-retention";

export type TrustReport = {
  generatedAt: string;
  metrics: Awaited<ReturnType<typeof getMetricsSnapshot>>;
  retention: Awaited<ReturnType<typeof getWorkflowRetentionDays>>;
  watchRuleCount: number;
  watchRules: string[];
  googleConnection: Awaited<ReturnType<typeof getGoogleConnectionStatus>>;
};

export async function getTrustReport(now = new Date()): Promise<TrustReport> {
  const [metrics, retention, watchRules, googleConnection] = await Promise.all([
    getMetricsSnapshot(now),
    getWorkflowRetentionDays(),
    listWatchKeywords(),
    getGoogleConnectionStatus(),
  ]);

  return {
    generatedAt: now.toISOString(),
    metrics,
    retention,
    watchRuleCount: watchRules.length,
    watchRules,
    googleConnection,
  };
}
