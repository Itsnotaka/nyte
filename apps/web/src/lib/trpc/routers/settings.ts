import {
  DEFAULT_INBOX_SECTION_ORDER,
  DIFF_SETTINGS_DEFAULTS,
  db,
  prFilesSchema,
  settingsSchema,
} from "@sachikit/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../trpc";

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
const viewedFilesInputSchema = z.object({
  owner: z.string().min(1),
  pullNumber: z.number().int().positive(),
  repo: z.string().min(1),
});
const viewedFileMutationSchema = viewedFilesInputSchema.extend({
  filePath: z.string().min(1),
});

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

  getViewedFiles: protectedProcedure
    .input(viewedFilesInputSchema)
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const prefix = `${input.owner}/${input.repo}:`;
      const rows = await db
        .select({ filePath: prFilesSchema.prFileViewed.filePath })
        .from(prFilesSchema.prFileViewed)
        .where(
          and(
            eq(prFilesSchema.prFileViewed.userId, userId),
            eq(prFilesSchema.prFileViewed.prId, input.pullNumber)
          )
        );
      return rows.flatMap((row) =>
        row.filePath.startsWith(prefix)
          ? [row.filePath.slice(prefix.length)]
          : []
      );
    }),

  markFileViewed: protectedProcedure
    .input(viewedFileMutationSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const scopedPath = `${input.owner}/${input.repo}:${input.filePath}`;
      await db
        .insert(prFilesSchema.prFileViewed)
        .values({
          filePath: scopedPath,
          prId: input.pullNumber,
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
    .input(viewedFileMutationSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const scopedPath = `${input.owner}/${input.repo}:${input.filePath}`;
      await db
        .delete(prFilesSchema.prFileViewed)
        .where(
          and(
            eq(prFilesSchema.prFileViewed.userId, userId),
            eq(prFilesSchema.prFileViewed.prId, input.pullNumber),
            eq(prFilesSchema.prFileViewed.filePath, scopedPath)
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
