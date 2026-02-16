import type { TrustReport } from "./trust-report";

export type SecurityPosture = {
  status: "ok" | "warning";
  warnings: string[];
};

type SecurityPostureInput = Pick<TrustReport, "security" | "googleConnection">;

export function evaluateSecurityPosture(report: SecurityPostureInput): SecurityPosture {
  const warnings: string[] = [];

  if (!report.security.authzEnforced) {
    warnings.push("Session authorization is not enforced for current environment.");
  }

  if (report.security.authSecretSource !== "env") {
    warnings.push("BETTER_AUTH_SECRET is using development fallback secret.");
  }

  if (report.security.tokenEncryptionKeySource !== "env") {
    warnings.push("NYTE_TOKEN_ENCRYPTION_KEY is using development fallback key.");
  }

  if (report.security.rateLimitMode === "unkey" && report.security.rateLimitProvider !== "unkey") {
    warnings.push("NYTE_RATE_LIMIT_MODE is set to unkey but UNKEY_ROOT_KEY is not configured.");
  } else if (report.security.rateLimitProvider !== "unkey") {
    warnings.push("UNKEY_ROOT_KEY is not configured; using in-process fallback rate limiter.");
  }

  if (!report.googleConnection.connected) {
    warnings.push("Google connection vault is disconnected.");
  }

  return {
    status: warnings.length === 0 ? "ok" : "warning",
    warnings,
  };
}
