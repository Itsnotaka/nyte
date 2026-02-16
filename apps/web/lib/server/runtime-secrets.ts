const DEV_BETTER_AUTH_SECRET = "vQ8n9xJ2kLm4Pq7rSt0Uv3Wx6Yz1Ab5Cd8Ef2Gh";

export type SecretSource = "env" | "dev-fallback";

function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

function isBuildPhase() {
  return process.env.NEXT_PHASE === "phase-production-build";
}

export function getBetterAuthSecret() {
  const configuredSecret = process.env.BETTER_AUTH_SECRET;
  if (configuredSecret) {
    return {
      value: configuredSecret,
      source: "env" as SecretSource,
    };
  }

  if (isProductionRuntime() && !isBuildPhase()) {
    throw new Error("BETTER_AUTH_SECRET is required in production.");
  }

  return {
    value: DEV_BETTER_AUTH_SECRET,
    source: "dev-fallback" as SecretSource,
  };
}

export function getTokenEncryptionKeySource() {
  return process.env.NYTE_TOKEN_ENCRYPTION_KEY
    ? ("env" as SecretSource)
    : ("dev-fallback" as SecretSource);
}
