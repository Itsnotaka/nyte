import { notFound } from "next/navigation";

import {
  getQueryClient,
  HydrateClient,
  trpc,
} from "~/lib/trpc/server-components";

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

  const queryClient = getQueryClient();
  const pageData = await queryClient
    .fetchQuery(
      trpc.github.getPullRequestPage.queryOptions({
        owner,
        repo,
        pullNumber,
      })
    )
    .catch(() => null);

  if (!pageData) {
    notFound();
  }

  return (
    <HydrateClient>
      <PullRequestView owner={owner} repo={repo} pullNumber={pullNumber} />
    </HydrateClient>
  );
}
