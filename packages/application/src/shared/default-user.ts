import { db, users } from "@nyte/db";

export const DEFAULT_USER_ID = "local-user";
export const DEFAULT_USER_EMAIL = "local-user@nyte.dev";

export async function ensureDefaultUser(now: Date) {
  await db
    .insert(users)
    .values({
      id: DEFAULT_USER_ID,
      email: DEFAULT_USER_EMAIL,
      name: "Local Nyte User",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        updatedAt: now,
      },
    });
}
