import {
  buildPullRequestReviewSignals,
  computeReviewDecision,
  getPullRequest,
  listPullRequestReviews,
  listRepositoryPullRequests,
  type ReviewDecision,
} from "@sachikit/github";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { findRepoContext } from "~/lib/github/server";

import { PullRequestListView } from "./_components/pull-request-list-view";

export const metadata: Metadata = {
  title: "Pull requests",
};

type PageProps = {
  params: Promise<{ owner: string; repo: string }>;
};

export default async function RepoPullsPage({ params }: PageProps) {
  const { owner, repo } = await params;
  const context = await findRepoContext(owner, repo);

  if (!context) {
    notFound();
  }

  const prsResult = await listRepositoryPullRequests(
    context.auth,
    owner,
    context.repository.name,
    "open"
  );

  if (prsResult.isErr()) {
    throw new Error(
      `Failed to fetch pull requests: ${prsResult.error instanceof Error ? prsResult.error.message : String(prsResult.error)}`
    );
  }

  const rawPulls = prsResult.value;

  const enrichedPulls = await Promise.all(
    rawPulls.map(async (pr) => {
      const [detail, reviews] = await Promise.all([
        getPullRequest(
          context.auth,
          owner,
          context.repository.name,
          pr.number
        ).unwrapOr(pr),
        listPullRequestReviews(
          context.auth,
          owner,
          context.repository.name,
          pr.number
        ).unwrapOr([]),
      ]);

      const reviewDecision: ReviewDecision = computeReviewDecision(
        buildPullRequestReviewSignals(detail, reviews)
      );

      return {
        ...detail,
        repoFullName: context.repository.full_name,
        repoOwner: owner,
        repoName: repo,
        reviewDecision,
      };
    })
  );

  return (
    <PullRequestListView
      repository={context.repository}
      pullRequests={enrichedPulls}
    />
  );
}
