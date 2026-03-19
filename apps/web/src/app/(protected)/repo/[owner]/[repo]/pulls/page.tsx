import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getRepositoryPullRequestsPageData } from "~/lib/github/server";

import { PullRequestListView } from "./_components/pull-request-list-view";

export const metadata: Metadata = {
  title: "Pull requests",
};

type PageProps = {
  params: Promise<{ owner: string; repo: string }>;
};

export default async function RepoPullsPage({ params }: PageProps) {
  const { owner, repo } = await params;
  const data = await getRepositoryPullRequestsPageData(owner, repo);
  if (!data) {
    notFound();
  }

  return <PullRequestListView repository={data.repository} pullRequests={data.pullRequests} />;
}
