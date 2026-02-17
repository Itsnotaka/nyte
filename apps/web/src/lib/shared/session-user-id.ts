import { asRecord } from "./value-guards";

export function resolveSessionUserId(value: unknown): string | null {
  const session = asRecord(value);
  if (!session) {
    return null;
  }

  const user = asRecord(session.user);
  if (!user) {
    return null;
  }

  const userId = user.id;
  if (typeof userId !== "string" || userId.trim().length === 0) {
    return null;
  }

  return userId;
}
