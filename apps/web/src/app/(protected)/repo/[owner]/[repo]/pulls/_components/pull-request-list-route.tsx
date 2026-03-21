"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/lib/trpc/react";

import { PullRequestListSkeleton, PullRequestListView } from "./pull-request-list-view";

type PullRequestListRouteProps = {
  owner: string;
  repo: string;
};

function isNotFound(err: unknown): err is { data?: { code?: string } } {
  if (typeof err !== "object" || err === null || !("data" in err)) {
    return false;
  }

  const data = err.data;
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return false;
  }

  return data.code === "NOT_FOUND";
}

export function PullRequestListRoute({ owner, repo }: PullRequestListRouteProps) {
  const trpc = useTRPC();
  const live = typeof window !== "undefined";
  const page = useQuery(
    trpc.github.getRepoPullsPage.queryOptions(
      {
        owner,
        repo,
      },
      {
        enabled: live,
        staleTime: 60_000,
        refetchOnWindowFocus: false,
      },
    ),
  );

  if (page.error) {
    if (isNotFound(page.error)) {
      throw new Error("Pull request list not found.");
    }

    throw page.error;
  }

  if (!page.data) {
    return <PullRequestListSkeleton />;
  }

  return <PullRequestListView repository={page.data.repository} pullRequests={page.data.pullRequests} />;
}
