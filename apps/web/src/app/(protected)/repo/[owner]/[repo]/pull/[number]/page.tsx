import { notFound } from "next/navigation";

import { getPullRequestPageData } from "~/lib/github/server";

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

  const initialData = await getPullRequestPageData(owner, repo, pullNumber);
  if (!initialData) {
    notFound();
  }

  return <PullRequestView initialData={initialData} />;
}
