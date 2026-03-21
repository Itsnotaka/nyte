"use client";

import type { GitHubBranch, GitHubFileContent } from "@sachikit/github";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@sachikit/ui/components/breadcrumb";
import { Skeleton } from "@sachikit/ui/components/skeleton";
import { InsetView } from "@sachikit/ui/components/sidebar";
import { useRouter } from "next/navigation";
import * as React from "react";

import { BranchSelector } from "./branch-selector";
import { FileContentView } from "./file-content-view";

type FileBrowserViewProps = {
  owner: string;
  repo: string;
  currentRef: string;
  defaultBranch: string;
  file: GitHubFileContent;
  branches: GitHubBranch[];
  filePath: string;
};

export function FileBrowserSkeleton() {
  return (
    <InsetView maxWidth="xl">
      <div className="space-y-6">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-10 w-48" />
          </div>

          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-3" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-3" />
            <Skeleton className="h-4 w-28" />
          </div>
        </header>

        <div className="overflow-hidden rounded-lg border border-sachi-line">
          <div className="flex items-center justify-between border-b border-sachi-line-subtle px-4 py-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-28 rounded-md" />
            </div>
          </div>

          <div className="space-y-2 px-4 py-3">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-8 shrink-0" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </InsetView>
  );
}

export function FileBrowserView({
  owner,
  repo,
  currentRef,
  file,
  branches,
  filePath,
}: FileBrowserViewProps) {
  const router = useRouter();

  function handleRefChange(ref: string) {
    router.push(`/repo/${owner}/${repo}/blob/${filePath}?ref=${ref}`);
  }

  const pathSegments = filePath.split("/");

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

        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href={`/repo/${owner}/${repo}?ref=${currentRef}`}>
                {repo}
              </BreadcrumbLink>
            </BreadcrumbItem>
            {pathSegments.map((segment, i) => {
              const isLast = i === pathSegments.length - 1;
              const href = isLast
                ? undefined
                : `/repo/${owner}/${repo}/tree/${pathSegments.slice(0, i + 1).join("/")}?ref=${currentRef}`;
              return (
                <React.Fragment key={i}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage>{segment}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink href={href!}>{segment}</BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <FileContentView file={file} />
    </InsetView>
  );
}
