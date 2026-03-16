import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { InboxView } from "./inbox-view";

function renderInbox(additions: number | null, deletions: number | null) {
  return renderToStaticMarkup(
    <InboxView
      data={{
        login: "alice",
        pullRequests: [
          {
            id: 1,
            number: 6,
            html_url: "https://example.com/pr/6",
            title: "Enhance application functionality and update dependencies",
            body: null,
            state: "open",
            draft: false,
            merged: false,
            comments: null,
            review_comments: null,
            commits: null,
            additions,
            deletions,
            changed_files: additions == null || deletions == null ? null : additions + deletions,
            created_at: "2026-03-16T16:00:00Z",
            updated_at: "2026-03-16T16:12:18Z",
            user: {
              login: "alice",
              id: 1,
              avatar_url: "https://example.com/alice.png",
              type: "User",
            },
            requested_reviewers: [
              {
                login: "bob",
                id: 2,
                avatar_url: "https://example.com/bob.png",
                type: "User",
              },
            ],
            head: { ref: "feature", sha: "abc" },
            base: { ref: "main", sha: "def" },
            repoFullName: "Itsnotaka/sachi",
            repoOwner: "Itsnotaka",
            repoName: "sachi",
          },
        ],
      }}
    />,
  );
}

describe("InboxView diff badges", () => {
  it("shows an unavailable placeholder when list responses do not include diff stats", () => {
    const html = renderInbox(null, null);

    expect(html).toContain('text-sachi-fg-faint">—</span>');
    expect(html).not.toContain(">+0<");
    expect(html).not.toContain(">-0<");
  });

  it("still renders real diff counts when they are available", () => {
    const html = renderInbox(12, 3);

    expect(html).toContain("+12");
    expect(html).toContain("-3");
  });
});
