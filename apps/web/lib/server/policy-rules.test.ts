import { beforeEach, describe, expect, it } from "vitest";
import {
  calendarEvents,
  connectedAccounts,
  db,
  ensureDbSchema,
  feedbackEntries,
  gateEvaluations,
  gmailDrafts,
  policyRules,
  proposedActions,
  users,
  workflowEvents,
  workflowRuns,
  workItems,
} from "@workspace/db";

import { addWatchKeyword, listWatchKeywords, removeWatchKeyword } from "./policy-rules";

async function resetDb() {
  await ensureDbSchema();
  await db.delete(calendarEvents);
  await db.delete(gmailDrafts);
  await db.delete(feedbackEntries);
  await db.delete(workflowEvents);
  await db.delete(workflowRuns);
  await db.delete(proposedActions);
  await db.delete(gateEvaluations);
  await db.delete(policyRules);
  await db.delete(workItems);
  await db.delete(connectedAccounts);
  await db.delete(users);
}

describe("policy-rules watch keyword management", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("adds, deduplicates, and removes watch keywords", async () => {
    await addWatchKeyword(" Renewal ", new Date("2026-01-20T12:00:00.000Z"));
    await addWatchKeyword("BOARD", new Date("2026-01-20T12:01:00.000Z"));
    await addWatchKeyword("renewal", new Date("2026-01-20T12:02:00.000Z"));

    const afterAdd = await listWatchKeywords();
    expect(afterAdd).toEqual(expect.arrayContaining(["renewal", "board"]));
    expect(afterAdd.filter((keyword) => keyword === "renewal")).toHaveLength(1);

    await removeWatchKeyword("board");
    const afterRemove = await listWatchKeywords();
    expect(afterRemove).toContain("renewal");
    expect(afterRemove).not.toContain("board");
  });
});
