import {
  getTrustReport as getApplicationTrustReport,
  type TrustReport,
} from "@nyte/application/trust-report";
import {
  getRateLimitMode,
  getRateLimitProvider,
  isUnkeyRateLimitActive,
  isUnkeyRateLimitConfigured,
} from "./rate-limit";
import { shouldEnforceAuthz } from "./authz";

export type { TrustReport };

export async function getTrustReport(now = new Date()): Promise<TrustReport> {
  return getApplicationTrustReport(now, {
    shouldEnforceAuthz,
    getRateLimitMode,
    getRateLimitProvider,
    isUnkeyRateLimitConfigured,
    isUnkeyRateLimitActive,
  });
}
