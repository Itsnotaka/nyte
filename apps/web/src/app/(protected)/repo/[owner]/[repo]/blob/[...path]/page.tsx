import { notFound } from "next/navigation";

import { findRepoContext, getRepoBranches, getRepoFileContent } from "~/lib/github/server";

import { FileBrowserView } from "../../../../_components/file-browser-view";

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
  const [file, branches] = await Promise.all([
    getRepoFileContent(owner, repo, filePath, currentRef),
    getRepoBranches(owner, repo),
  ]);

  if (!file) notFound();

  return (
    <FileBrowserView
      owner={owner}
      repo={repo}
      currentRef={currentRef}
      defaultBranch={context.repository.default_branch}
      file={file}
      branches={branches}
      filePath={filePath}
    />
  );
}
