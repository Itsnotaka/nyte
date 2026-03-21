"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/lib/trpc/react";

import { FileBrowserSkeleton, FileBrowserView } from "./file-browser-view";

type FileBrowserRouteProps = {
  owner: string;
  repo: string;
  currentRef: string;
  defaultBranch: string;
  filePath: string;
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

export function FileBrowserRoute({
  owner,
  repo,
  currentRef,
  defaultBranch,
  filePath,
}: FileBrowserRouteProps) {
  const trpc = useTRPC();
  const live = typeof window !== "undefined";
  const file = useQuery(
    trpc.github.getFileContent.queryOptions(
      {
        owner,
        repo,
        ref: currentRef,
        path: filePath,
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

  if (file.error) {
    if (isNotFound(file.error)) {
      throw new Error("File not found.");
    }

    throw file.error;
  }

  if (branches.error) {
    throw branches.error;
  }

  if (!file.data || !branches.data) {
    return <FileBrowserSkeleton />;
  }

  return (
    <FileBrowserView
      owner={owner}
      repo={repo}
      currentRef={currentRef}
      defaultBranch={defaultBranch}
      file={file.data}
      branches={branches.data}
      filePath={filePath}
    />
  );
}
