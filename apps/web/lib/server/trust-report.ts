import { getGoogleConnectionStatus } from "./connections";
import { getMetricsSnapshot } from "./metrics";
import { listWatchKeywords } from "./policy-rules";
import { getWorkflowRetentionDays } from "./workflow-retention";
import { shouldEnforceAuthz } from "./authz";

export type TrustReport = {
  generatedAt: string;
  metrics: Awaited<ReturnType<typeof getMetricsSnapshot>>;
  retention: Awaited<ReturnType<typeof getWorkflowRetentionDays>>;
  watchRuleCount: number;
  watchRules: string[];
  googleConnection: Awaited<ReturnType<typeof getGoogleConnectionStatus>>;
  security: {
    authzEnforced: boolean;
    betterAuthSecretConfigured: boolean;
    tokenEncryptionKeyConfigured: boolean;
    hasPreviousTokenKey: boolean;
  };
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
    security: {
      authzEnforced: shouldEnforceAuthz(),
      betterAuthSecretConfigured: Boolean(process.env.BETTER_AUTH_SECRET),
      tokenEncryptionKeyConfigured: Boolean(process.env.NYTE_TOKEN_ENCRYPTION_KEY),
      hasPreviousTokenKey: Boolean(process.env.NYTE_TOKEN_ENCRYPTION_KEY_PREVIOUS),
    },
  };
}
