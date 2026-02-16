import { getGoogleConnectionStatus } from "./connections";
import { getMetricsSnapshot } from "./metrics";
import { listWatchKeywords } from "./policy-rules";
import { getWorkflowRetentionDays } from "./workflow-retention";
import { shouldEnforceAuthz } from "./authz";
import { getBetterAuthSecret, getTokenEncryptionKeySource } from "./runtime-secrets";
import { evaluateSecurityPosture, type SecurityPosture } from "./security-posture";

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
    betterAuthSecretSource: "env" | "dev-fallback";
    tokenEncryptionKeyConfigured: boolean;
    tokenEncryptionKeySource: "env" | "dev-fallback";
    hasPreviousTokenKey: boolean;
  };
  posture: SecurityPosture;
};

export async function getTrustReport(now = new Date()): Promise<TrustReport> {
  const betterAuthSecret = getBetterAuthSecret();
  const tokenEncryptionKeySource = getTokenEncryptionKeySource();
  const [metrics, retention, watchRules, googleConnection] = await Promise.all([
    getMetricsSnapshot(now),
    getWorkflowRetentionDays(),
    listWatchKeywords(),
    getGoogleConnectionStatus(),
  ]);

  const report = {
    generatedAt: now.toISOString(),
    metrics,
    retention,
    watchRuleCount: watchRules.length,
    watchRules,
    googleConnection,
    security: {
      authzEnforced: shouldEnforceAuthz(),
      betterAuthSecretConfigured: Boolean(process.env.BETTER_AUTH_SECRET),
      betterAuthSecretSource: betterAuthSecret.source,
      tokenEncryptionKeyConfigured: Boolean(process.env.NYTE_TOKEN_ENCRYPTION_KEY),
      tokenEncryptionKeySource,
      hasPreviousTokenKey: Boolean(process.env.NYTE_TOKEN_ENCRYPTION_KEY_PREVIOUS),
    },
  };

  return {
    ...report,
    posture: evaluateSecurityPosture(report),
  };
}
