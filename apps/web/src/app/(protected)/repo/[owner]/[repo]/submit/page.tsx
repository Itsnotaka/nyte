import { createSearchParamsCache, parseAsString, type SearchParams } from "nuqs/server";

import { HydrateClient, prefetch, trpc } from "~/lib/trpc/server";

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

  prefetch(
    trpc.github.getRepoSubmitPage.queryOptions({
      owner,
      repo,
      branch: branch ?? null,
    }),
  );

  return (
    <HydrateClient>
      <RepoSubmitView owner={owner} repo={repo} />
    </HydrateClient>
  );
}
