import { isLikelyEmail } from "@nyte/extension-runtime";
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./lib/auth";

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeDisplay(value: string, fallbackEmail: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallbackEmail;
}

export const search = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const limit = Math.min(Math.max(args.limit ?? 8, 1), 20);
    const queryText = args.query.trim().toLowerCase();

    const rows = await ctx.db
      .query("contacts")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(150);

    const filtered = queryText
      ? rows.filter((row) => {
          const email = row.email.toLowerCase();
          const display = row.display.toLowerCase();
          return email.includes(queryText) || display.includes(queryText);
        })
      : rows;

    return filtered.slice(0, limit).map((row) => ({
      contactId: row.contactId,
      email: row.email,
      display: row.display,
    }));
  },
});

export const upsertMany = internalMutation({
  args: {
    userId: v.string(),
    contacts: v.array(
      v.object({
        email: v.string(),
        display: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const rawContact of args.contacts) {
      const email = normalizeEmail(rawContact.email);
      if (!email) {
        continue;
      }
      const display = normalizeDisplay(rawContact.display, email);
      const existing = await ctx.db
        .query("contacts")
        .withIndex("by_user_email", (q) =>
          q.eq("userId", args.userId).eq("email", email)
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          display,
          lastUsedAt: now,
          updatedAt: now,
        });
        continue;
      }

      await ctx.db.insert("contacts", {
        userId: args.userId,
        contactId: `contact:${args.userId}:${email}`,
        email,
        display,
        lastUsedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { ok: true };
  },
});

export const addFromEmail = mutation({
  args: {
    email: v.string(),
    display: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const email = normalizeEmail(args.email);
    if (!isLikelyEmail(email)) {
      throw new ConvexError("Enter a valid email address.");
    }

    const display = normalizeDisplay(args.display ?? "", email);
    await ctx.runMutation(internal.contacts.upsertMany, {
      userId,
      contacts: [{ email, display }],
    });

    const saved = await ctx.db
      .query("contacts")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", userId).eq("email", email)
      )
      .unique();

    if (!saved) {
      throw new ConvexError("Unable to add contact.");
    }

    return {
      contactId: saved.contactId,
      email: saved.email,
      display: saved.display,
    };
  },
});
