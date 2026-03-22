import { notFound } from "next/navigation";
import { Suspense } from "react";

import { HydrateClient, prefetch, trpc } from "~/lib/trpc/server";

import { PullRequestSkeleton, PullRequestView } from "../../../../_components/pull-request-view";

type PullRequestPageProps = {
  params: Promise<{
    owner: string;
    repo: string;
    number: string;
  }>;
};

export default async function PullRequestPage({ params }: PullRequestPageProps) {
  const { owner, repo, number } = await params;
  const pullNumber = Number(number);
  if (!Number.isInteger(pullNumber) || pullNumber <= 0) {
    notFound();
  }

  await Promise.all([
    prefetch(
      trpc.github.getPullRequestPage.queryOptions({
        owner,
        repo,
        pullNumber,
      }),
    ),
    prefetch(
      trpc.github.getPullRequestStack.queryOptions({
        owner,
        repo,
        pullNumber,
      }),
    ),
  ]);

  return (
    <HydrateClient>
      <Suspense fallback={<PullRequestSkeleton />}>
        <PullRequestView owner={owner} repo={repo} pullNumber={pullNumber} />
      </Suspense>
    </HydrateClient>
  );
}
