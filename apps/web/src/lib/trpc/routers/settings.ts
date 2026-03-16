import { DIFF_SETTINGS_DEFAULTS, db, settingsSchema } from "@sachikit/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../server";

const diffSettingsSchema = z.object({
  contextLines: z.number().int().min(1).max(20),
  diffStyle: z.enum(["unified", "split"]),
  hideComments: z.boolean(),
  lineDiffType: z.enum(["word-alt", "word", "char", "none"]),
  overflow: z.enum(["scroll", "wrap"]),
});

const partialDiffSettingsSchema = diffSettingsSchema.partial();

export const settingsRouter = createTRPCRouter({
  getDiffSettings: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const row = await db.query.userDiffSettings.findFirst({
      where: eq(settingsSchema.userDiffSettings.userId, userId),
    });

    return row?.settings ?? DIFF_SETTINGS_DEFAULTS;
  }),

  updateDiffSettings: protectedProcedure
    .input(partialDiffSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const existing = await db.query.userDiffSettings.findFirst({
        where: eq(settingsSchema.userDiffSettings.userId, userId),
      });

      const merged = {
        ...DIFF_SETTINGS_DEFAULTS,
        ...existing?.settings,
        ...input,
      };

      await db
        .insert(settingsSchema.userDiffSettings)
        .values({
          settings: merged,
          updatedAt: new Date(),
          userId,
        })
        .onConflictDoUpdate({
          set: { settings: merged, updatedAt: new Date() },
          target: settingsSchema.userDiffSettings.userId,
        });

      return merged;
    }),
});
