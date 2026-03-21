"use client";

import type { GitHubBranch, GitHubTree } from "@sachikit/github";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@sachikit/ui/components/breadcrumb";
import { InsetView } from "@sachikit/ui/components/sidebar";
import { Skeleton } from "@sachikit/ui/components/skeleton";
import { useRouter } from "next/navigation";
import * as React from "react";

import { BranchSelector } from "./branch-selector";
import { RepoTreeView } from "./repo-tree-view";

type RepoBrowserViewProps = {
  owner: string;
  repo: string;
  currentRef: string;
  defaultBranch: string;
  tree: GitHubTree;
  branches: GitHubBranch[];
  currentPath?: string;
};

export function RepoBrowserSkeleton({ crumbs = false }: { crumbs?: boolean }) {
  return (
    <InsetView maxWidth="xl">
      <div className="space-y-6">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-10 w-48" />
          </div>

          {crumbs ? (
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-3" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-3" />
              <Skeleton className="h-4 w-28" />
            </div>
          ) : null}
        </header>

        <div className="overflow-hidden rounded-lg border border-sachi-line">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-sachi-line-subtle px-3 py-2 last:border-b-0"
            >
              <Skeleton className="size-4 shrink-0" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    </InsetView>
  );
}

export function RepoBrowserView({
  owner,
  repo,
  currentRef,
  tree,
  branches,
  currentPath,
}: RepoBrowserViewProps) {
  const router = useRouter();

  function handleRefChange(ref: string) {
    const basePath = currentPath
      ? `/repo/${owner}/${repo}/tree/${currentPath}`
      : `/repo/${owner}/${repo}`;
    router.push(`${basePath}?ref=${ref}`);
  }

  const pathSegments = currentPath ? currentPath.split("/") : [];

  return (
    <InsetView maxWidth="xl">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-sachi-fg">
            {owner}/{repo}
          </h1>
          <BranchSelector
            branches={branches}
            currentRef={currentRef}
            onRefChange={handleRefChange}
          />
        </div>

        {pathSegments.length > 0 ? (
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href={`/repo/${owner}/${repo}?ref=${currentRef}`}>
                  {repo}
                </BreadcrumbLink>
              </BreadcrumbItem>
              {pathSegments.map((segment, i) => {
                const isLast = i === pathSegments.length - 1;
                const href = `/repo/${owner}/${repo}/tree/${pathSegments.slice(0, i + 1).join("/")}?ref=${currentRef}`;
                return (
                  <React.Fragment key={i}>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {isLast ? (
                        <BreadcrumbPage>{segment}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink href={href}>{segment}</BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        ) : null}
      </header>

      <RepoTreeView
        owner={owner}
        repo={repo}
        ref={currentRef}
        entries={tree.tree}
        currentPath={currentPath}
      />

      {tree.truncated ? (
        <p className="text-xs text-sachi-fg-muted">Tree is truncated. Not all entries are shown.</p>
      ) : null}
    </InsetView>
  );
}
