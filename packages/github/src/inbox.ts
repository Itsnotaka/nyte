import type { GitHubPullRequest, GitHubPullRequestReview } from "./types.ts";

export type ReviewDecision = "approved" | "changes_requested" | "review_required" | "none";

export type PullRequestReviewSignals = {
  activeReviewerLogins: string[];
  approverLogins: string[];
  hasActiveReview: boolean;
  hasApprovals: boolean;
  hasUnaddressedChangesRequested: boolean;
  isFullyApproved: boolean;
  requestedReviewerLogins: string[];
  rerequestedReviewerLogins: string[];
};

export type InboxPullRequest = GitHubPullRequest & {
  repoFullName: string;
  repoOwner: string;
  repoName: string;
  reviewDecision: ReviewDecision;
};

export type ClassifiedInboxPullRequest = InboxPullRequest & {
  reviewSignals: PullRequestReviewSignals;
};

export type InboxSectionId =
  | "needs_review"
  | "returned"
  | "approved"
  | "merging"
  | "waiting_author"
  | "drafts"
  | "waiting_reviewers";

export type InboxSection = {
  id: InboxSectionId;
  label: string;
  items: InboxPullRequest[];
};

export type ClassifyPullRequestsOptions = {
  recentlyMergedSince?: string;
};

export type InboxClassificationFacts = {
  isActiveReviewer: boolean;
  isApprover: boolean;
  isAuthor: boolean;
  isDraft: boolean;
  isMerging: boolean;
  isOpen: boolean;
  isRecentlyMerged: boolean;
  isRerequestedReviewer: boolean;
  isRequestedReviewer: boolean;
  signals: PullRequestReviewSignals;
};

export type InboxConditionPreset =
  | "has_active_review"
  | "has_approvals"
  | "has_unaddressed_changes_requested"
  | "is_active_reviewer"
  | "is_approver"
  | "is_author"
  | "is_draft"
  | "is_fully_approved"
  | "is_merging"
  | "is_open"
  | "is_recently_merged"
  | "is_rerequested_reviewer"
  | "is_requested_reviewer";

export type InboxCondition =
  | { type: "all"; conditions: InboxCondition[] }
  | { type: "any"; conditions: InboxCondition[] }
  | { type: "not"; condition: InboxCondition }
  | { type: "preset"; preset: InboxConditionPreset };

export type InboxSectionRule = {
  condition: InboxCondition;
  id: InboxSectionId;
  label: string;
};

function preset(presetName: InboxConditionPreset): InboxCondition {
  return { type: "preset", preset: presetName };
}

function all(...conditions: InboxCondition[]): InboxCondition {
  return { type: "all", conditions };
}

function any(...conditions: InboxCondition[]): InboxCondition {
  return { type: "any", conditions };
}

function not(condition: InboxCondition): InboxCondition {
  return { type: "not", condition };
}

const IS_AUTHOR = preset("is_author");
const IS_OPEN = preset("is_open");
const IS_DRAFT = preset("is_draft");
const IS_MERGING = preset("is_merging");
const IS_RECENTLY_MERGED = preset("is_recently_merged");
const IS_REQUESTED_REVIEWER = preset("is_requested_reviewer");
const IS_REREQUESTED_REVIEWER = preset("is_rerequested_reviewer");
const IS_ACTIVE_REVIEWER = preset("is_active_reviewer");
const IS_APPROVER = preset("is_approver");
const HAS_ACTIVE_REVIEW = preset("has_active_review");
const HAS_APPROVALS = preset("has_approvals");
const HAS_UNADDRESSED_CHANGES_REQUESTED = preset("has_unaddressed_changes_requested");
const IS_FULLY_APPROVED = preset("is_fully_approved");

const OPEN_NON_DRAFT_NON_MERGING = all(IS_OPEN, not(IS_DRAFT), not(IS_MERGING));
const AUTHOR_OPEN_NON_DRAFT_NON_MERGING = all(OPEN_NON_DRAFT_NON_MERGING, IS_AUTHOR);
const REVIEWER_OPEN_NON_DRAFT_NON_MERGING = all(OPEN_NON_DRAFT_NON_MERGING, not(IS_AUTHOR));

export const DEFAULT_INBOX_SECTION_RULES: InboxSectionRule[] = [
  {
    condition: any(
      all(
        REVIEWER_OPEN_NON_DRAFT_NON_MERGING,
        IS_REQUESTED_REVIEWER,
        not(HAS_UNADDRESSED_CHANGES_REQUESTED),
        not(IS_FULLY_APPROVED),
      ),
      all(
        REVIEWER_OPEN_NON_DRAFT_NON_MERGING,
        IS_REQUESTED_REVIEWER,
        not(HAS_UNADDRESSED_CHANGES_REQUESTED),
        not(HAS_APPROVALS),
      ),
      all(
        REVIEWER_OPEN_NON_DRAFT_NON_MERGING,
        IS_REREQUESTED_REVIEWER,
        not(HAS_UNADDRESSED_CHANGES_REQUESTED),
      ),
    ),
    id: "needs_review",
    label: "Needs your review",
  },
  {
    condition: any(
      all(AUTHOR_OPEN_NON_DRAFT_NON_MERGING, not(IS_FULLY_APPROVED), HAS_ACTIVE_REVIEW),
      all(AUTHOR_OPEN_NON_DRAFT_NON_MERGING, not(HAS_APPROVALS), HAS_ACTIVE_REVIEW),
      all(AUTHOR_OPEN_NON_DRAFT_NON_MERGING, HAS_UNADDRESSED_CHANGES_REQUESTED),
    ),
    id: "returned",
    label: "Returned to you",
  },
  {
    condition: all(
      AUTHOR_OPEN_NON_DRAFT_NON_MERGING,
      HAS_APPROVALS,
      IS_FULLY_APPROVED,
      not(HAS_UNADDRESSED_CHANGES_REQUESTED),
    ),
    id: "approved",
    label: "Approved",
  },
  {
    condition: any(all(IS_AUTHOR, IS_MERGING, IS_OPEN), IS_RECENTLY_MERGED),
    id: "merging",
    label: "Merging and recently merged",
  },
  {
    condition: any(
      all(REVIEWER_OPEN_NON_DRAFT_NON_MERGING, IS_ACTIVE_REVIEWER),
      all(OPEN_NON_DRAFT_NON_MERGING, IS_APPROVER, not(IS_REREQUESTED_REVIEWER)),
    ),
    id: "waiting_author",
    label: "Waiting for author",
  },
  {
    condition: all(IS_AUTHOR, IS_OPEN, IS_DRAFT, not(IS_MERGING)),
    id: "drafts",
    label: "Drafts",
  },
  {
    condition: any(
      all(AUTHOR_OPEN_NON_DRAFT_NON_MERGING, not(HAS_ACTIVE_REVIEW), not(IS_FULLY_APPROVED)),
      all(AUTHOR_OPEN_NON_DRAFT_NON_MERGING, not(HAS_ACTIVE_REVIEW), not(HAS_APPROVALS)),
    ),
    id: "waiting_reviewers",
    label: "Waiting for reviewers",
  },
];

export function buildPullRequestReviewSignals(
  pullRequest: GitHubPullRequest,
  reviews: GitHubPullRequestReview[],
): PullRequestReviewSignals {
  const latestByUser = new Map<string, GitHubPullRequestReview>();
  for (const review of reviews) {
    if (review.state === "PENDING") continue;
    const existing = latestByUser.get(review.user.login);
    if (!existing || (review.submitted_at ?? "") > (existing.submitted_at ?? "")) {
      latestByUser.set(review.user.login, review);
    }
  }
  const requestedReviewerLogins = pullRequest.requested_reviewers.map((reviewer) =>
    reviewer.login.toLowerCase(),
  );
  const reviewersWithPriorSubmissions = new Set(
    reviews
      .filter((review) => review.state !== "PENDING")
      .map((review) => review.user.login.toLowerCase()),
  );

  const approverLogins: string[] = [];
  const activeReviewerLogins: string[] = [];

  for (const [login, review] of latestByUser) {
    if (review.state === "APPROVED") {
      approverLogins.push(login.toLowerCase());
      continue;
    }
    if (review.state === "CHANGES_REQUESTED" || review.state === "COMMENTED") {
      activeReviewerLogins.push(login.toLowerCase());
    }
  }

  const hasApprovals = approverLogins.length > 0;
  const hasUnaddressedChangesRequested = Array.from(latestByUser.values()).some(
    (review) => review.state === "CHANGES_REQUESTED",
  );
  const hasActiveReview = activeReviewerLogins.length > 0;
  const rerequestedReviewerLogins = requestedReviewerLogins.filter((login) =>
    reviewersWithPriorSubmissions.has(login),
  );

  return {
    activeReviewerLogins,
    approverLogins,
    hasActiveReview,
    hasApprovals,
    hasUnaddressedChangesRequested,
    isFullyApproved:
      hasApprovals &&
      !hasUnaddressedChangesRequested &&
      !hasActiveReview &&
      requestedReviewerLogins.length === 0,
    requestedReviewerLogins,
    rerequestedReviewerLogins,
  };
}

export function computeReviewDecision(signals: PullRequestReviewSignals): ReviewDecision {
  if (signals.hasUnaddressedChangesRequested) return "changes_requested";
  if (signals.isFullyApproved || signals.hasApprovals) return "approved";
  if (signals.requestedReviewerLogins.length > 0 || signals.hasActiveReview) {
    return "review_required";
  }
  return "none";
}

export function deriveInboxClassificationFacts(
  login: string,
  pullRequest: ClassifiedInboxPullRequest,
  options?: ClassifyPullRequestsOptions,
): InboxClassificationFacts {
  const lower = login.toLowerCase();
  const signals = pullRequest.reviewSignals;
  const isAuthor = pullRequest.user.login.toLowerCase() === lower;
  const isOpen = pullRequest.state === "open" && !pullRequest.merged;
  const isDraft = isOpen && pullRequest.draft;
  const isMerging = isOpen && pullRequest.auto_merge_enabled;
  const isRecentlyMerged =
    pullRequest.merged &&
    (options?.recentlyMergedSince == null || pullRequest.updated_at >= options.recentlyMergedSince);

  return {
    isActiveReviewer: signals.activeReviewerLogins.includes(lower),
    isApprover: signals.approverLogins.includes(lower),
    isAuthor,
    isDraft,
    isMerging,
    isOpen,
    isRecentlyMerged,
    isRerequestedReviewer: signals.rerequestedReviewerLogins.includes(lower),
    isRequestedReviewer: signals.requestedReviewerLogins.includes(lower),
    signals,
  };
}

export function matchesInboxConditionPreset(
  presetName: InboxConditionPreset,
  facts: InboxClassificationFacts,
): boolean {
  switch (presetName) {
    case "has_active_review":
      return facts.signals.hasActiveReview;
    case "has_approvals":
      return facts.signals.hasApprovals;
    case "has_unaddressed_changes_requested":
      return facts.signals.hasUnaddressedChangesRequested;
    case "is_active_reviewer":
      return facts.isActiveReviewer;
    case "is_approver":
      return facts.isApprover;
    case "is_author":
      return facts.isAuthor;
    case "is_draft":
      return facts.isDraft;
    case "is_fully_approved":
      return facts.signals.isFullyApproved;
    case "is_merging":
      return facts.isMerging;
    case "is_open":
      return facts.isOpen;
    case "is_recently_merged":
      return facts.isRecentlyMerged;
    case "is_rerequested_reviewer":
      return facts.isRerequestedReviewer;
    case "is_requested_reviewer":
      return facts.isRequestedReviewer;
  }
}

export function matchesInboxCondition(
  condition: InboxCondition,
  facts: InboxClassificationFacts,
): boolean {
  switch (condition.type) {
    case "all":
      return condition.conditions.every((entry) => matchesInboxCondition(entry, facts));
    case "any":
      return condition.conditions.some((entry) => matchesInboxCondition(entry, facts));
    case "not":
      return !matchesInboxCondition(condition.condition, facts);
    case "preset":
      return matchesInboxConditionPreset(condition.preset, facts);
  }
}

export function classifyPullRequests(
  login: string,
  pullRequests: ClassifiedInboxPullRequest[],
  options?: ClassifyPullRequestsOptions,
): { sections: InboxSection[]; unclassifiedCount: number } {
  const sectionItemsById = new Map<InboxSectionId, InboxPullRequest[]>(
    DEFAULT_INBOX_SECTION_RULES.map((rule) => [rule.id, []]),
  );
  let unclassifiedCount = 0;

  for (const pr of pullRequests) {
    const facts = deriveInboxClassificationFacts(login, pr, options);
    const matchingRule = DEFAULT_INBOX_SECTION_RULES.find((rule) =>
      matchesInboxCondition(rule.condition, facts),
    );
    if (!matchingRule) {
      unclassifiedCount++;
      continue;
    }
    const sectionItems = sectionItemsById.get(matchingRule.id);
    if (sectionItems) {
      sectionItems.push(pr);
    }
  }

  return {
    sections: DEFAULT_INBOX_SECTION_RULES.map((rule) => ({
      id: rule.id,
      items: sectionItemsById.get(rule.id) ?? [],
      label: rule.label,
    })),
    unclassifiedCount,
  };
}
