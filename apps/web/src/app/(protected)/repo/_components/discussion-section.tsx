import type {
  GitHubPullRequestReview,
  GitHubRepository,
} from "@sachikit/github";
import { Badge } from "@sachikit/ui/components/badge";
import { Skeleton } from "@sachikit/ui/components/skeleton";
import { cn } from "@sachikit/ui/lib/utils";
import { useSuspenseQuery } from "@tanstack/react-query";

import { formatRelativeTime } from "~/lib/time";
import { useTRPC } from "~/lib/trpc/react";

import { Section } from "./layout-sections";
import { MarkdownContent } from "./markdown-content";
import type { PullRequestQueryInput } from "./types";

type PullRequestDiscussionSectionProps = {
  queryInput: PullRequestQueryInput;
  repository: GitHubRepository;
};

export function PullRequestDiscussionFallback() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <div className="space-y-3 rounded-lg border border-sachi-line-subtle bg-sachi-base px-4 py-4">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-16" />
        <div className="space-y-3 rounded-lg border border-sachi-line-subtle bg-sachi-base px-4 py-4">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      </div>
    </div>
  );
}

function reviewStateBadgeClass(review: GitHubPullRequestReview): string {
  return cn(
    review.state === "APPROVED" && "border-green-600 text-green-700",
    review.state === "CHANGES_REQUESTED" && "border-red-500 text-red-600"
  );
}

function reviewStateLabel(review: GitHubPullRequestReview): string {
  if (review.state === "APPROVED") return "approved";
  if (review.state === "CHANGES_REQUESTED") return "changes requested";
  if (review.state === "COMMENTED") return "commented";
  return review.state.toLowerCase();
}

export function PullRequestDiscussionSection({
  queryInput,
  repository,
}: PullRequestDiscussionSectionProps) {
  const trpc = useTRPC();
  const discussionQuery = useSuspenseQuery(
    trpc.github.getPullRequestDiscussion.queryOptions(queryInput, {
      staleTime: 60_000,
    })
  );
  const { issueComments, reviews } = discussionQuery.data;

  if (issueComments.length === 0 && reviews.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {issueComments.length > 0 ? (
        <Section title="Discussion">
          <div className="space-y-4">
            {issueComments.map((comment) => (
              <div key={comment.id} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-sachi-fg-muted">
                  <span className="font-medium text-sachi-fg-secondary">
                    {comment.user.login}
                  </span>
                  <span>{formatRelativeTime(comment.updated_at)}</span>
                </div>
                <MarkdownContent
                  className="pull-request-markdown text-sm text-sachi-fg-secondary"
                  content={comment.body}
                  repository={repository}
                />
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {reviews.length > 0 ? (
        <Section title="Reviews">
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-sachi-fg-muted">
                  <span className="font-medium text-sachi-fg-secondary">
                    {review.user.login}
                  </span>
                  <Badge
                    variant="outline"
                    className={reviewStateBadgeClass(review)}
                  >
                    {reviewStateLabel(review)}
                  </Badge>
                  {review.submitted_at ? (
                    <span>{formatRelativeTime(review.submitted_at)}</span>
                  ) : null}
                </div>
                {review.body ? (
                  <MarkdownContent
                    className="pull-request-markdown text-sm text-sachi-fg-secondary"
                    content={review.body}
                    repository={repository}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
