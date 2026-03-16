import type { FileDiffMetadata } from "@pierre/diffs";
import { parsePatchFiles } from "@pierre/diffs";
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

function parseFiles(diff: string): FileDiffMetadata[] {
  if (diff.trim().length === 0) {
    return [];
  }

  return parsePatchFiles(diff).flatMap((patch) => patch.files);
}

export default async function PullRequestPage({ params }: PullRequestPageProps) {
  const { owner, repo, number } = await params;
  const pullNumber = Number(number);
  if (!Number.isInteger(pullNumber) || pullNumber <= 0) {
    notFound();
  }

  const data = await getPullRequestPageData(owner, repo, pullNumber);
  if (!data) {
    notFound();
  }

  return (
    <PullRequestView
      files={parseFiles(data.diff)}
      issueComments={data.issueComments}
      pullRequest={data.pullRequest}
      repository={data.repository}
      reviewComments={data.reviewComments}
      reviews={data.reviews}
    />
  );
}
