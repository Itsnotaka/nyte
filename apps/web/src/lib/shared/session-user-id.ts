export function resolveSessionUserId(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const user = (value as { user?: unknown }).user;
  if (!user || typeof user !== "object" || Array.isArray(user)) {
    return null;
  }

  const userId = (user as { id?: unknown }).id;
  if (typeof userId !== "string" || userId.trim().length === 0) {
    return null;
  }

  return userId;
}
