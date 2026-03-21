import { notFound } from "next/navigation";

import { findRepoContext } from "~/lib/github/server";

import { FileBrowserRoute } from "../../../../_components/file-browser-route";

type BlobPageProps = {
  params: Promise<{ owner: string; repo: string; path: string[] }>;
  searchParams: Promise<{ ref?: string }>;
};

export default async function BlobPage({ params, searchParams }: BlobPageProps) {
  const { owner, repo, path } = await params;
  const { ref } = await searchParams;

  const context = await findRepoContext(owner, repo);
  if (!context) notFound();

  const currentRef = ref ?? context.repository.default_branch;
  const filePath = path.join("/");
  return (
    <FileBrowserRoute
      owner={owner}
      repo={repo}
      currentRef={currentRef}
      defaultBranch={context.repository.default_branch}
      filePath={filePath}
    />
  );
}
