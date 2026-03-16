import { createSearchParamsCache, parseAsString, type SearchParams } from "nuqs/server";
import { notFound } from "next/navigation";

import {
  getBranchPullRequest,
  getRepoBranches,
  getRepoPullRequests,
} from "~/lib/github/server";

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
  const repoData = await getRepoBranches(owner, repo);
  if (!repoData) {
    notFound();
  }

  const { branch } = await submitSearchParamsCache.parse(searchParams);
  const branches = repoData.branches.filter(
    (item) => item.name !== repoData.repository.default_branch
  );
  const selectedBranch =
    branch && branches.some((item) => item.name === branch)
      ? branch
      : branches[0]?.name ?? null;

  const [branchData, pullRequestData] = await Promise.all([
    selectedBranch
      ? getBranchPullRequest(owner, repo, selectedBranch)
      : Promise.resolve(null),
    getRepoPullRequests(owner, repo),
  ]);

  return (
    <RepoSubmitView
      key={selectedBranch ?? "no-branch"}
      branches={repoData.branches}
      existingPullRequest={branchData?.pullRequest ?? null}
      initialBranch={selectedBranch}
      openPullRequests={pullRequestData?.pullRequests ?? []}
      repository={repoData.repository}
    />
  );
}
