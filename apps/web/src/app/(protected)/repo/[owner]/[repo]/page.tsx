import { notFound } from "next/navigation";

import { findRepoContext, getRepoBranches, getRepoTree } from "~/lib/github/server";

import { RepoBrowserView } from "../../_components/repo-browser-view";

type RepoPageProps = {
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<{ ref?: string }>;
};

export default async function RepoPage({ params, searchParams }: RepoPageProps) {
  const { owner, repo } = await params;
  const { ref } = await searchParams;

  const context = await findRepoContext(owner, repo);
  if (!context) notFound();

  const currentRef = ref ?? context.repository.default_branch;
  const [tree, branches] = await Promise.all([
    getRepoTree(owner, repo, currentRef),
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
    />
  );
}
