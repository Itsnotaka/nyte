import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const DEV_FALLBACK_KEY = "nyte-dev-token-encryption-key";

function getEncryptionKey() {
  const configuredKey = process.env.NYTE_TOKEN_ENCRYPTION_KEY;
  if (process.env.NODE_ENV === "production" && !configuredKey) {
    throw new Error("NYTE_TOKEN_ENCRYPTION_KEY is required in production.");
  }

  const source = configuredKey ?? DEV_FALLBACK_KEY;
  return createHash("sha256").update(source).digest();
}

export function encryptSecret(value: string) {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64url");
}

export function decryptSecret(payload: string) {
  const key = getEncryptionKey();
  const data = Buffer.from(payload, "base64url");
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const encrypted = data.subarray(28);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
