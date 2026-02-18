import { db } from "@nyte/db/client";
import { users } from "@nyte/db/schema";

export const DEFAULT_USER_ID = "local-user";
const DEFAULT_USER_EMAIL = "local-user@nyte.dev";

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
