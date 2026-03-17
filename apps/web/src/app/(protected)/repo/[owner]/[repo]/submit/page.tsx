import { notFound } from "next/navigation";
import {
  createSearchParamsCache,
  parseAsString,
  type SearchParams,
} from "nuqs/server";

import {
  getQueryClient,
  HydrateClient,
  trpc,
} from "~/lib/trpc/server-components";

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

export default async function SubmitPage({
  params,
  searchParams,
}: SubmitPageProps) {
  const { owner, repo } = await params;
  const { branch } = await submitSearchParamsCache.parse(searchParams);

  const queryClient = getQueryClient();
  const pageData = await queryClient
    .fetchQuery(
      trpc.github.getRepoSubmitPage.queryOptions({
        owner,
        repo,
        branch: branch ?? null,
      })
    )
    .catch(() => null);

  if (!pageData) {
    notFound();
  }

  return (
    <HydrateClient>
      <RepoSubmitView owner={owner} repo={repo} />
    </HydrateClient>
  );
}
