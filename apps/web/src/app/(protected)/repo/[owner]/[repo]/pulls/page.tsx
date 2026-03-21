import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { findRepoContext } from "~/lib/github/server";

import { PullRequestListRoute } from "./_components/pull-request-list-route";

export const metadata: Metadata = {
  title: "Pull requests",
};

type PageProps = {
  params: Promise<{ owner: string; repo: string }>;
};

export default async function RepoPullsPage({ params }: PageProps) {
  const { owner, repo } = await params;
  if (!(await findRepoContext(owner, repo))) {
    notFound();
  }

  return <PullRequestListRoute owner={owner} repo={repo} />;
}
