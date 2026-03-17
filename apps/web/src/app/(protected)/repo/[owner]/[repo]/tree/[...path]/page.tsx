import { notFound } from "next/navigation";

import { findRepoContext, getRepoBranches, getRepoTree } from "~/lib/github/server";

import { RepoBrowserView } from "../../../../_components/repo-browser-view";

type TreePageProps = {
  params: Promise<{ owner: string; repo: string; path: string[] }>;
  searchParams: Promise<{ ref?: string }>;
};

export default async function TreePage({ params, searchParams }: TreePageProps) {
  const { owner, repo, path } = await params;
  const { ref } = await searchParams;

  const context = await findRepoContext(owner, repo);
  if (!context) notFound();

  const currentRef = ref ?? context.repository.default_branch;
  const currentPath = path.join("/");
  const [tree, branches] = await Promise.all([
    getRepoTree(owner, repo, currentRef, currentPath),
    getRepoBranches(owner, repo),
  ]);

  if (!tree) notFound();

  return (
    <RepoBrowserView
      owner={owner}
      repo={repo}
      currentRef={currentRef}
      defaultBranch={context.repository.default_branch}
      tree={tree}
      branches={branches}
      currentPath={currentPath}
    />
  );
}
