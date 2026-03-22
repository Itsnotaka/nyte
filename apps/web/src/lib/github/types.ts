import "server-only";
import type {
  BranchComparison,
  GitHubAppInstallationAuth,
  GitHubBranch,
  GitHubCheckRun,
  GitHubCheckSummary,
  GitHubInstallation,
  GitHubIssueComment,
  GitHubPullRequest,
  GitHubPullRequestReview,
  GitHubRepository,
  InboxSectionId,
  ReviewDecision,
} from "@sachikit/github";

export type {
  InboxPullRequest,
  InboxSection,
  InboxSectionId,
  ReviewDecision,
} from "@sachikit/github";

export type SetupRedirectInput = {
  installationId: number | null;
  setupAction: string | null;
};

export type OnboardingState =
  | { step: "no_user_session" }
  | { step: "no_github_user_token" }
  | { step: "no_github_installation" }
  | {
      step: "has_installations";
      installations: GitHubInstallation[];
    };

export type RepoContext = {
  installation: GitHubInstallation;
  repository: GitHubRepository;
  auth: GitHubAppInstallationAuth;
};

export type PullRequestPageData = {
  repository: GitHubRepository;
  pullRequest: GitHubPullRequest;
};

export type PullRequestDiscussionData = {
  issueComments: GitHubIssueComment[];
  reviews: GitHubPullRequestReview[];
};

export type RepoSubmitPageData = {
  repository: GitHubRepository;
  branches: GitHubBranch[];
  selectedBranch: string | null;
  existingPullRequest: GitHubPullRequest | null;
  openPullRequests: GitHubPullRequest[];
};

export type InboxPullRequestRow = {
  id: number;
  number: number;
  title: string;
  state: GitHubPullRequest["state"];
  merged: boolean;
  additions: number | null;
  deletions: number | null;
  updated_at: string;
  user: {
    avatar_url: string;
    login: string;
  };
  head: {
    sha: string;
  };
  base: {
    sha: string;
  };
  repoFullName: string;
  repoOwner: string;
  repoName: string;
  reviewDecision: ReviewDecision;
};

export type InboxSectionData = {
  id: InboxSectionId;
  label: string;
  items: InboxPullRequestRow[];
};

export type SyncedRepoLookupRow = {
  githubRepoId: number;
  installationId: number;
  ownerLogin: string;
  repoName: string;
};

export type RepoCatalogEntry = {
  installation: GitHubInstallation;
  repository: GitHubRepository;
};

export type RepoCatalog = {
  installations: GitHubInstallation[];
  entries: RepoCatalogEntry[];
  repos: GitHubRepository[];
};

export type SyncedRepoCatalog = RepoCatalog & {
  syncedRepoIds: Set<number>;
  syncedEntries: RepoCatalogEntry[];
  syncedRepos: GitHubRepository[];
  totalAccessible: number;
  totalSynced: number;
};

export type StackEntry = {
  number: number;
  title: string;
  headRef: string;
  baseRef: string;
  state: "open" | "closed" | "merged";
  isCurrent: boolean;
};

export type StackHealthEntry = StackEntry & {
  needsRestack: boolean;
  behindBy: number;
  comparison: BranchComparison | null;
};

export type GitHubCheckRef = {
  owner: string;
  repo: string;
  ref: string;
};

export type GitHubCheckReport = {
  runs: GitHubCheckRun[];
  summary: GitHubCheckSummary;
};

export type InboxData = {
  sections: InboxSectionData[];
  diagnostics: InboxDiagnostics;
};

export type InboxProbeMode = "graphql" | "rest";

export type InboxProbeData = {
  diagnostics: {
    accessibleRepoCount: number;
    fetchedCount: number;
    itemCount: number;
    partialFailures: string[];
    serverMs: number;
    source: InboxProbeMode;
    syncedRepoCount: number;
  };
  id: string;
  items: InboxPullRequestRow[];
  label: string;
};

export type InboxDiagnostics = {
  fetchedCount: number;
  classifiedCount: number;
  unclassifiedCount: number;
  partialFailures: string[];
  syncedRepoCount: number;
  accessibleRepoCount: number;
};
