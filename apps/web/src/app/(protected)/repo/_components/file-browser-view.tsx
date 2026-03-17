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

      <FileContentView file={file} owner={owner} repo={repo} />
    </InsetView>
  );
}
