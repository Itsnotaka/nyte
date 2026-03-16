import { notFound } from "next/navigation";
import { createSearchParamsCache, parseAsString, type SearchParams } from "nuqs/server";

import { getRepoSubmitPageData } from "~/lib/github/server";

import { RepoSubmitView } from "../../../_components/repo-submit-view";

const submitSearchParamsCache = createSearchParamsCache({
  branch: parseAsString,
});

type SubmitPageProps = {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
  searchParams: Promise<SearchParams>;
};

export default async function SubmitPage({ params, searchParams }: SubmitPageProps) {
  const { owner, repo } = await params;
  const { branch } = await submitSearchParamsCache.parse(searchParams);

  const initialData = await getRepoSubmitPageData(owner, repo, branch ?? null);
  if (!initialData) {
    notFound();
  }

  return <RepoSubmitView initialData={initialData} />;
}
