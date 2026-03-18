import { notFound } from "next/navigation";

import { caller, HydrateClient, prefetch, trpc } from "~/lib/trpc/server";

import { PullRequestView } from "../../../../_components/pull-request-view";

type PullRequestPageProps = {
  params: Promise<{
    owner: string;
    repo: string;
    number: string;
  }>;
};

export default async function PullRequestPage({
  params,
}: PullRequestPageProps) {
  const { owner, repo, number } = await params;
  const pullNumber = Number(number);
  if (!Number.isInteger(pullNumber) || pullNumber <= 0) {
    notFound();
  }

  const page = await caller.github.getPullRequestPage({
    owner,
    repo,
    pullNumber,
  });

  prefetch(
    trpc.github.getPullRequestDiscussion.queryOptions({
      owner,
      repo,
      pullNumber,
    })
  );
  prefetch(
    trpc.github.getPullRequestFiles.queryOptions({
      owner,
      repo,
      pullNumber,
      page: 1,
      perPage: 1,
    })
  );
  prefetch(
    trpc.github.getPullRequestReviewComments.queryOptions({
      owner,
      repo,
      pullNumber,
    })
  );
  prefetch(
    trpc.github.getPullRequestStack.queryOptions({
      owner,
      repo,
      pullNumber,
    })
  );
  prefetch(
    trpc.github.getCheckSummary.queryOptions({
      owner,
      repo,
      ref: page.pullRequest.head.sha,
    })
  );
  prefetch(trpc.settings.getDiffSettings.queryOptions());
  prefetch(
    trpc.settings.getViewedFiles.queryOptions({
      owner,
      pullNumber,
      repo,
    })
  );

  return (
    <HydrateClient>
      <PullRequestView owner={owner} repo={repo} pullNumber={pullNumber} />
    </HydrateClient>
  );
}
