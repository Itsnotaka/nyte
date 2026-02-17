import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { Result } from "neverthrow";

const ALGORITHM = "aes-256-gcm";
const FORMAT_VERSION = "v1";
const FORMAT_DELIMITER = ".";

type MaterializedKey = {
  id: string;
  value: Buffer;
};

export type TokenCryptoEnvironment = Record<string, string | undefined> & {
  NYTE_TOKEN_ENCRYPTION_KEY?: string;
  NYTE_TOKEN_ENCRYPTION_KEY_PREVIOUS?: string;
};

function normalizeSecret(value: string | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function deriveKey(source: string): Buffer {
  return createHash("sha256").update(source).digest();
}

function getEncryptionKeys(
  environment: TokenCryptoEnvironment
): MaterializedKey[] {
  const primarySource = normalizeSecret(environment.NYTE_TOKEN_ENCRYPTION_KEY);
  if (!primarySource) {
    throw new Error(
      "NYTE_TOKEN_ENCRYPTION_KEY is required. Set it in apps/web/.env or apps/web/.env.local."
    );
  }

  const previousSources = (
    normalizeSecret(environment.NYTE_TOKEN_ENCRYPTION_KEY_PREVIOUS) ?? ""
  )
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const keySources = [...new Set([primarySource, ...previousSources])];
  return keySources.map((source, index) => ({
    id: `k${index}`,
    value: deriveKey(source),
  }));
}

function encryptWithKey(value: string, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64url");
}

function decryptWithKey(payload: string, key: Buffer) {
  const data = Buffer.from(payload, "base64url");
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const encrypted = data.subarray(28);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function encryptSecret(
  value: string,
  environment: TokenCryptoEnvironment = process.env
) {
  const key = getEncryptionKeys(environment)[0];
  if (!key) {
    throw new Error("No encryption key available.");
  }

  const encrypted = encryptWithKey(value, key.value);
  return [FORMAT_VERSION, key.id, encrypted].join(FORMAT_DELIMITER);
}

export function decryptSecret(
  payload: string,
  environment: TokenCryptoEnvironment = process.env
) {
  const keys = getEncryptionKeys(environment);
  const segments = payload.split(FORMAT_DELIMITER);
  const formatVersion = segments[0];
  const keyId = segments[1];
  const encryptedPayload = segments.slice(2).join(FORMAT_DELIMITER);
  const isVersioned =
    formatVersion === FORMAT_VERSION &&
    typeof keyId === "string" &&
    keyId.length > 0 &&
    encryptedPayload.length > 0;
  const encoded = isVersioned ? encryptedPayload : payload;
  const tryDecrypt = Result.fromThrowable(decryptWithKey, () => null);

  if (isVersioned) {
    const preferred = keys.find((entry) => entry.id === keyId);
    const fallback = keys.filter((entry) => entry.id !== keyId);

    for (const candidate of preferred ? [preferred, ...fallback] : keys) {
      const decrypted = tryDecrypt(encoded, candidate.value);
      if (decrypted.isOk()) {
        return decrypted.value;
      }
    }
    throw new Error("Unable to decrypt payload with configured keys.");
  }

  for (const candidate of keys) {
    const decrypted = tryDecrypt(encoded, candidate.value);
    if (decrypted.isOk()) {
      return decrypted.value;
    }
  }

  throw new Error("Unable to decrypt payload with configured keys.");
}
