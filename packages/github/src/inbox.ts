import type { GitHubPullRequest, GitHubPullRequestReview } from "./types.ts";

export type ReviewDecision =
  | "approved"
  | "changes_requested"
  | "review_required"
  | "none";

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

type ClassifyPullRequestsOptions = {
  recentlyMergedSince?: string;
};

export function buildPullRequestReviewSignals(
  pullRequest: GitHubPullRequest,
  reviews: GitHubPullRequestReview[]
): PullRequestReviewSignals {
  const latestByUser = new Map<string, GitHubPullRequestReview>();
  for (const review of reviews) {
    if (review.state === "PENDING") continue;
    const existing = latestByUser.get(review.user.login);
    if (
      !existing ||
      (review.submitted_at ?? "") > (existing.submitted_at ?? "")
    ) {
      latestByUser.set(review.user.login, review);
    }
  }
  const requestedReviewerLogins = pullRequest.requested_reviewers.map(
    (reviewer) => reviewer.login.toLowerCase()
  );
  const reviewersWithPriorSubmissions = new Set(
    reviews
      .filter((review) => review.state !== "PENDING")
      .map((review) => review.user.login.toLowerCase())
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
    (review) => review.state === "CHANGES_REQUESTED"
  );
  const hasActiveReview = activeReviewerLogins.length > 0;
  const rerequestedReviewerLogins = requestedReviewerLogins.filter((login) =>
    reviewersWithPriorSubmissions.has(login)
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

export function computeReviewDecision(
  signals: PullRequestReviewSignals
): ReviewDecision {
  if (signals.hasUnaddressedChangesRequested) return "changes_requested";
  if (signals.isFullyApproved || signals.hasApprovals) return "approved";
  if (signals.requestedReviewerLogins.length > 0 || signals.hasActiveReview) {
    return "review_required";
  }
  return "none";
}

export function classifyPullRequests(
  login: string,
  pullRequests: ClassifiedInboxPullRequest[],
  options?: ClassifyPullRequestsOptions
): { sections: InboxSection[]; unclassifiedCount: number } {
  const needsReview: InboxPullRequest[] = [];
  const waitingReviewers: InboxPullRequest[] = [];
  const drafts: InboxPullRequest[] = [];
  const returned: InboxPullRequest[] = [];
  const approved: InboxPullRequest[] = [];
  const merging: InboxPullRequest[] = [];
  const waitingAuthor: InboxPullRequest[] = [];

  const lower = login.toLowerCase();
  let unclassifiedCount = 0;

  for (const pr of pullRequests) {
    const signals = pr.reviewSignals;
    const isAuthor = pr.user.login.toLowerCase() === lower;
    const isOpen = pr.state === "open" && !pr.merged;
    const isDraft = isOpen && pr.draft;
    const isMerging = isOpen && pr.auto_merge_enabled;
    const isRecentlyMerged =
      pr.merged &&
      (options?.recentlyMergedSince == null ||
        pr.updated_at >= options.recentlyMergedSince);
    const isRequestedReviewer = signals.requestedReviewerLogins.includes(lower);
    const isRerequestedReviewer =
      signals.rerequestedReviewerLogins.includes(lower);
    const isActiveReviewer = signals.activeReviewerLogins.includes(lower);
    const isApprover = signals.approverLogins.includes(lower);

    if (
      (!isAuthor &&
        !isDraft &&
        !isMerging &&
        isOpen &&
        isRequestedReviewer &&
        !signals.hasUnaddressedChangesRequested &&
        !signals.isFullyApproved) ||
      (!isAuthor &&
        !isDraft &&
        !isMerging &&
        isOpen &&
        isRequestedReviewer &&
        !signals.hasUnaddressedChangesRequested &&
        !signals.hasApprovals) ||
      (!isAuthor &&
        !isDraft &&
        !isMerging &&
        isOpen &&
        isRerequestedReviewer &&
        !signals.hasUnaddressedChangesRequested)
    ) {
      needsReview.push(pr);
    } else if (
      (!isDraft &&
        !isMerging &&
        isOpen &&
        isAuthor &&
        !signals.isFullyApproved &&
        signals.hasActiveReview) ||
      (!isDraft &&
        !isMerging &&
        isOpen &&
        isAuthor &&
        !signals.hasApprovals &&
        signals.hasActiveReview) ||
      (!isDraft &&
        !isMerging &&
        isOpen &&
        isAuthor &&
        signals.hasUnaddressedChangesRequested)
    ) {
      returned.push(pr);
    } else if (
      !isDraft &&
      !isMerging &&
      isOpen &&
      isAuthor &&
      signals.hasApprovals &&
      signals.isFullyApproved &&
      !signals.hasUnaddressedChangesRequested
    ) {
      approved.push(pr);
    } else if ((isAuthor && isMerging && isOpen) || isRecentlyMerged) {
      merging.push(pr);
    } else if (
      (isOpen && !isDraft && !isMerging && isActiveReviewer && !isAuthor) ||
      (isOpen && !isDraft && !isMerging && isApprover && !isRerequestedReviewer)
    ) {
      waitingAuthor.push(pr);
    } else if (isAuthor && isOpen && isDraft && !isMerging) {
      drafts.push(pr);
    } else if (
      (isAuthor &&
        isOpen &&
        !isDraft &&
        !isMerging &&
        !signals.hasActiveReview &&
        !signals.isFullyApproved) ||
      (isAuthor &&
        isOpen &&
        !isDraft &&
        !isMerging &&
        !signals.hasActiveReview &&
        !signals.hasApprovals)
    ) {
      waitingReviewers.push(pr);
    } else {
      unclassifiedCount++;
    }
  }

  return {
    sections: [
      { id: "needs_review", label: "Needs your review", items: needsReview },
      { id: "returned", label: "Returned to you", items: returned },
      { id: "approved", label: "Approved", items: approved },
      { id: "merging", label: "Merging and recently merged", items: merging },
      {
        id: "waiting_author",
        label: "Waiting for author",
        items: waitingAuthor,
      },
      { id: "drafts", label: "Drafts", items: drafts },
      {
        id: "waiting_reviewers",
        label: "Waiting for reviewers",
        items: waitingReviewers,
      },
    ],
    unclassifiedCount,
  };
}
