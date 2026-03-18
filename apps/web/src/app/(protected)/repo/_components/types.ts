import type { GitHubPullRequestReviewComment } from "@sachikit/github";

export type PullRequestQueryInput = {
  owner: string;
  repo: string;
  pullNumber: number;
};

export type DraftComment = {
  id: string;
  path: string;
  body: string;
  lineNumber: number;
  side: "LEFT" | "RIGHT";
};

export type AnnotationPayload =
  | { kind: "existing"; comment: GitHubPullRequestReviewComment }
  | { kind: "draft"; draft: DraftComment };

export type ReviewAction = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
