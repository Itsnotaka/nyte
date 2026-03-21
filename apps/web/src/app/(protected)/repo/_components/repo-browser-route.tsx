"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/lib/trpc/react";

import { RepoBrowserSkeleton, RepoBrowserView } from "./repo-browser-view";

type RepoBrowserRouteProps = {
  owner: string;
  repo: string;
  currentRef: string;
  defaultBranch: string;
  currentPath?: string;
};

export function RepoBrowserRoute({
  owner,
  repo,
  currentRef,
  defaultBranch,
  currentPath,
}: RepoBrowserRouteProps) {
  const trpc = useTRPC();
  const live = typeof window !== "undefined";
  const tree = useQuery(
    trpc.github.getRepoTree.queryOptions(
      {
        owner,
        repo,
        ref: currentRef,
        path: currentPath,
      },
      {
        enabled: live,
        staleTime: 60_000,
        refetchOnWindowFocus: false,
      },
    ),
  );
  const branches = useQuery(
    trpc.github.getRepoBranches.queryOptions(
      {
        owner,
        repo,
      },
      {
        enabled: live,
        staleTime: 5 * 60_000,
        refetchOnWindowFocus: false,
      },
    ),
  );

  if (tree.error) {
    throw tree.error;
  }

  if (branches.error) {
    throw branches.error;
  }

  if (tree.data === null) {
    throw new Error("Repository tree not found.");
  }

  if (!tree.data || !branches.data) {
    return <RepoBrowserSkeleton crumbs={Boolean(currentPath)} />;
  }

  return (
    <RepoBrowserView
      owner={owner}
      repo={repo}
      currentRef={currentRef}
      defaultBranch={defaultBranch}
      tree={tree.data}
      branches={branches.data}
      currentPath={currentPath}
    />
  );
}
