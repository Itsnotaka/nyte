import { notFound } from "next/navigation";

import { findRepoContext } from "~/lib/github/server";

import { RepoBrowserRoute } from "../../_components/repo-browser-route";

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
  return (
    <RepoBrowserRoute
      owner={owner}
      repo={repo}
      currentRef={currentRef}
      defaultBranch={context.repository.default_branch}
    />
  );
}
