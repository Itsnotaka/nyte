import { getGoogleConnectionStatus } from "./connections";
import { getMetricsSnapshot } from "./metrics";
import { listWatchKeywords } from "./policy-rules";
import { getWorkflowRetentionDays } from "./workflow-retention";
import { getAuthSecret, getTokenEncryptionKeySource } from "./runtime-secrets";
import { evaluateSecurityPosture, type SecurityPosture } from "./security-posture";
import { listAuditLogs } from "./audit-log";

export type RateLimitMode = "auto" | "memory" | "unkey";
export type RateLimitProvider = "memory" | "unkey";

type TrustReportDependencies = {
  shouldEnforceAuthz?: () => boolean;
  getRateLimitMode?: () => RateLimitMode;
  getRateLimitProvider?: () => RateLimitProvider;
  isUnkeyRateLimitConfigured?: () => boolean;
  isUnkeyRateLimitActive?: () => boolean;
};

function normalizeUnkeyRootKey(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  return normalized;
}

function normalizeRateLimitMode(value: string | undefined): RateLimitMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "memory" || normalized === "unkey") {
    return normalized;
  }

  return "auto";
}

function defaultShouldEnforceAuthz() {
  if (process.env.NYTE_REQUIRE_AUTH === "true") {
    return true;
  }

  return process.env.NODE_ENV === "production";
}

function defaultRateLimitMode(): RateLimitMode {
  return normalizeRateLimitMode(process.env.NYTE_RATE_LIMIT_MODE);
}

function defaultUnkeyConfigured() {
  return Boolean(normalizeUnkeyRootKey(process.env.UNKEY_ROOT_KEY));
}

function defaultRateLimitProvider(): RateLimitProvider {
  const mode = defaultRateLimitMode();
  const hasKey = defaultUnkeyConfigured();

  if (mode === "memory") {
    return "memory";
  }

  if (hasKey) {
    return "unkey";
  }

  return "memory";
}

function defaultUnkeyActive() {
  return defaultRateLimitProvider() === "unkey";
}

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
    runtimeAuthTokenConfigured: boolean;
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
  runtimeDelegation: {
    recentCount: number;
    acceptedCount: number;
    errorCount: number;
    latestCommand: string | null;
    latestOutcome: string | null;
    latestRequestId: string | null;
  };
};

export async function getTrustReport(
  now = new Date(),
  dependencies: TrustReportDependencies = {},
): Promise<TrustReport> {
  const authSecret = getAuthSecret();
  const tokenEncryptionKeySource = getTokenEncryptionKeySource();

  const shouldEnforceAuthz = dependencies.shouldEnforceAuthz ?? defaultShouldEnforceAuthz;
  const getRateLimitMode = dependencies.getRateLimitMode ?? defaultRateLimitMode;
  const getRateLimitProvider = dependencies.getRateLimitProvider ?? defaultRateLimitProvider;
  const isUnkeyRateLimitConfigured =
    dependencies.isUnkeyRateLimitConfigured ?? defaultUnkeyConfigured;
  const isUnkeyRateLimitActive = dependencies.isUnkeyRateLimitActive ?? defaultUnkeyActive;

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
      runtimeAuthTokenConfigured: Boolean(process.env.NYTE_RUNTIME_AUTH_TOKEN?.trim()),
      rateLimitMode: getRateLimitMode(),
      rateLimitProvider: getRateLimitProvider(),
      unkeyRateLimitConfigured: isUnkeyRateLimitConfigured(),
      unkeyRateLimitActive: isUnkeyRateLimitActive(),
    },
    audit: {
      recentCount: recentAuditLogs.length,
      latestAction: recentAuditLogs[0]?.action ?? null,
    },
    runtimeDelegation: (() => {
      const events = recentAuditLogs.filter((entry) =>
        entry.action.startsWith("runtime.delegate."),
      );
      const acceptedCount = events.filter((entry) => entry.action.endsWith(".accepted")).length;
      const latest = events[0];
      const segments = latest?.action.split(".") ?? [];
      const latestCommand = segments[2] ?? null;
      const latestOutcome = segments[3] ?? null;

      return {
        recentCount: events.length,
        acceptedCount,
        errorCount: events.length - acceptedCount,
        latestCommand,
        latestOutcome,
        latestRequestId: latest?.targetId ?? null,
      };
    })(),
  };

  return {
    ...report,
    posture: evaluateSecurityPosture(report),
  };
}
