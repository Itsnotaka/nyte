import {
  DEFAULT_INBOX_SECTION_ORDER,
  DIFF_SETTINGS_DEFAULTS,
  db,
  prFilesSchema,
  settingsSchema,
} from "@sachikit/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../server";

const VALID_SECTION_IDS = [
  "needs_review",
  "returned",
  "approved",
  "merging",
  "waiting_author",
  "drafts",
  "waiting_reviewers",
] as const;

const inboxSectionOrderSchema = z
  .array(z.enum(VALID_SECTION_IDS))
  .min(VALID_SECTION_IDS.length)
  .max(VALID_SECTION_IDS.length)
  .refine(
    (arr) => new Set(arr).size === arr.length,
    "Section order must not contain duplicates"
  );

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

  // --- Phase 1: Viewed files ---

  getViewedFiles: protectedProcedure
    .input(z.object({ prId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const rows = await db
        .select({ filePath: prFilesSchema.prFileViewed.filePath })
        .from(prFilesSchema.prFileViewed)
        .where(
          and(
            eq(prFilesSchema.prFileViewed.userId, userId),
            eq(prFilesSchema.prFileViewed.prId, input.prId)
          )
        );
      return rows.map((row) => row.filePath);
    }),

  markFileViewed: protectedProcedure
    .input(
      z.object({
        filePath: z.string().min(1),
        prId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await db
        .insert(prFilesSchema.prFileViewed)
        .values({
          filePath: input.filePath,
          prId: input.prId,
          userId,
          viewedAt: new Date(),
        })
        .onConflictDoUpdate({
          set: { viewedAt: new Date() },
          target: [
            prFilesSchema.prFileViewed.userId,
            prFilesSchema.prFileViewed.prId,
            prFilesSchema.prFileViewed.filePath,
          ],
        });
    }),

  markFileUnviewed: protectedProcedure
    .input(
      z.object({
        filePath: z.string().min(1),
        prId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await db
        .delete(prFilesSchema.prFileViewed)
        .where(
          and(
            eq(prFilesSchema.prFileViewed.userId, userId),
            eq(prFilesSchema.prFileViewed.prId, input.prId),
            eq(prFilesSchema.prFileViewed.filePath, input.filePath)
          )
        );
    }),

  getInboxSectionOrder: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const row = await db.query.userInboxSectionOrder.findFirst({
      where: eq(settingsSchema.userInboxSectionOrder.userId, userId),
    });
    return row?.sectionOrder ?? DEFAULT_INBOX_SECTION_ORDER;
  }),

  updateInboxSectionOrder: protectedProcedure
    .input(inboxSectionOrderSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await db
        .insert(settingsSchema.userInboxSectionOrder)
        .values({
          sectionOrder: input,
          updatedAt: new Date(),
          userId,
        })
        .onConflictDoUpdate({
          set: { sectionOrder: input, updatedAt: new Date() },
          target: settingsSchema.userInboxSectionOrder.userId,
        });
      return input;
    }),
});
