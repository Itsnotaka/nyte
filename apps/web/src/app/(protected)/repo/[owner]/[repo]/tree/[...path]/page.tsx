import { notFound } from "next/navigation";

import { findRepoContext } from "~/lib/github/server";

import { RepoBrowserRoute } from "../../../../_components/repo-browser-route";

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
  return (
    <RepoBrowserRoute
      owner={owner}
      repo={repo}
      currentRef={currentRef}
      defaultBranch={context.repository.default_branch}
      currentPath={currentPath}
    />
  );
}
