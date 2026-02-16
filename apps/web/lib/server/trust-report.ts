import { getGoogleConnectionStatus } from "./connections";
import { getMetricsSnapshot } from "./metrics";
import { listWatchKeywords } from "./policy-rules";
import { getWorkflowRetentionDays } from "./workflow-retention";
import { shouldEnforceAuthz } from "./authz";
import { getAuthSecret, getTokenEncryptionKeySource } from "./runtime-secrets";
import { evaluateSecurityPosture, type SecurityPosture } from "./security-posture";
import { listAuditLogs } from "./audit-log";
import {
  getRateLimitMode,
  getRateLimitProvider,
  isUnkeyRateLimitActive,
  isUnkeyRateLimitConfigured,
  type RateLimitMode,
  type RateLimitProvider,
} from "./rate-limit";

export type TrustReport = {
  generatedAt: string;
  metrics: Awaited<ReturnType<typeof getMetricsSnapshot>>;
  retention: Awaited<ReturnType<typeof getWorkflowRetentionDays>>;
  watchRuleCount: number;
  watchRules: string[];
  googleConnection: Awaited<ReturnType<typeof getGoogleConnectionStatus>>;
  security: {
    authzEnforced: boolean;
    authSecretConfigured: boolean;
    authSecretSource: "env" | "dev-fallback";
    tokenEncryptionKeyConfigured: boolean;
    tokenEncryptionKeySource: "env" | "dev-fallback";
    hasPreviousTokenKey: boolean;
    rateLimitMode: RateLimitMode;
    rateLimitProvider: RateLimitProvider;
    unkeyRateLimitConfigured: boolean;
    unkeyRateLimitActive: boolean;
  };
  posture: SecurityPosture;
  audit: {
    recentCount: number;
    latestAction: string | null;
  };
};

export async function getTrustReport(now = new Date()): Promise<TrustReport> {
  const authSecret = getAuthSecret();
  const tokenEncryptionKeySource = getTokenEncryptionKeySource();
  const rateLimitMode = getRateLimitMode();
  const rateLimitProvider = getRateLimitProvider();
  const [metrics, retention, watchRules, googleConnection, recentAuditLogs] = await Promise.all([
    getMetricsSnapshot(now),
    getWorkflowRetentionDays(),
    listWatchKeywords(),
    getGoogleConnectionStatus(),
    listAuditLogs(25),
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
      authSecretConfigured: Boolean(process.env.BETTER_AUTH_SECRET),
      authSecretSource: authSecret.source,
      tokenEncryptionKeyConfigured: Boolean(process.env.NYTE_TOKEN_ENCRYPTION_KEY),
      tokenEncryptionKeySource,
      hasPreviousTokenKey: Boolean(process.env.NYTE_TOKEN_ENCRYPTION_KEY_PREVIOUS),
      rateLimitMode,
      rateLimitProvider,
      unkeyRateLimitConfigured: isUnkeyRateLimitConfigured(),
      unkeyRateLimitActive: isUnkeyRateLimitActive(),
    },
    audit: {
      recentCount: recentAuditLogs.length,
      latestAction: recentAuditLogs[0]?.action ?? null,
    },
  };

  return {
    ...report,
    posture: evaluateSecurityPosture(report),
  };
}
