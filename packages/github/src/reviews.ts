import { Effect, Layer, ServiceMap } from "effect";

import { GitHubClientService } from "./client.ts";
import { toIssueComment, toReview, toReviewComment } from "./pull-request-mappers.ts";
import { toPullRequest } from "./pull-request-mappers.ts";
import {
  type GitHubAppInstallationAuth,
  type GitHubError,
  type GitHubIssueComment,
  type GitHubPullRequest,
  type GitHubPullRequestReview,
  type GitHubPullRequestReviewComment,
  type GitHubReviewCommentDraft,
  type GitHubReviewEvent,
} from "./types.ts";

type GitHubReviewsShape = {
  createIssueComment: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    issueNumber: number,
    body: string,
  ) => Effect.Effect<GitHubIssueComment, GitHubError>;
  listIssueComments: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    issueNumber: number,
  ) => Effect.Effect<GitHubIssueComment[], GitHubError>;
  listPullRequestReviewComments: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    pullNumber: number,
  ) => Effect.Effect<GitHubPullRequestReviewComment[], GitHubError>;
  listPullRequestReviews: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    pullNumber: number,
  ) => Effect.Effect<GitHubPullRequestReview[], GitHubError>;
  removeReviewers: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    pullNumber: number,
    reviewers: string[],
  ) => Effect.Effect<GitHubPullRequest, GitHubError>;
  requestReviewers: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    pullNumber: number,
    reviewers: string[],
  ) => Effect.Effect<GitHubPullRequest, GitHubError>;
  submitPullRequestReview: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    pullNumber: number,
    input: {
      event: GitHubReviewEvent;
      body?: string;
      commitId?: string;
      comments?: GitHubReviewCommentDraft[];
    },
  ) => Effect.Effect<GitHubPullRequestReview, GitHubError>;
};

export class GitHubReviewsService extends ServiceMap.Service<
  GitHubReviewsService,
  GitHubReviewsShape
>()("GitHubReviewsService", {
  make: Effect.gen(function* () {
    const clients = yield* GitHubClientService;
    return {
      createIssueComment: (auth, owner, repo, issueNumber, body) =>
        clients.withInstallationClient(
          auth,
          "github.reviews.createIssueComment",
          async (client) => {
            const response = await client.rest.issues.createComment({
              owner,
              repo,
              issue_number: issueNumber,
              body,
            });
            return toIssueComment(response.data);
          },
          { issueNumber, owner, repo },
        ),
      listIssueComments: (auth, owner, repo, issueNumber) =>
        clients.withInstallationClient(
          auth,
          "github.reviews.listIssueComments",
          async (client) => {
            const comments = await client.paginate(client.rest.issues.listComments, {
              owner,
              repo,
              issue_number: issueNumber,
              per_page: 100,
            });
            return comments.map(toIssueComment);
          },
          { issueNumber, owner, repo },
        ),
      listPullRequestReviewComments: (auth, owner, repo, pullNumber) =>
        clients.withInstallationClient(
          auth,
          "github.reviews.listPullRequestReviewComments",
          async (client) => {
            const comments = await client.paginate(client.rest.pulls.listReviewComments, {
              owner,
              repo,
              pull_number: pullNumber,
              per_page: 100,
            });
            return comments.map(toReviewComment);
          },
          { owner, pullNumber, repo },
        ),
      listPullRequestReviews: (auth, owner, repo, pullNumber) =>
        clients.withInstallationClient(
          auth,
          "github.reviews.listPullRequestReviews",
          async (client) => {
            const reviews = await client.paginate(client.rest.pulls.listReviews, {
              owner,
              repo,
              pull_number: pullNumber,
              per_page: 100,
            });
            return reviews.map(toReview);
          },
          { owner, pullNumber, repo },
        ),
      removeReviewers: (auth, owner, repo, pullNumber, reviewers) =>
        clients.withInstallationClient(
          auth,
          "github.reviews.removeReviewers",
          async (client) => {
            const response = await client.rest.pulls.removeRequestedReviewers({
              owner,
              repo,
              pull_number: pullNumber,
              reviewers,
            });
            return toPullRequest(response.data);
          },
          { owner, pullNumber, repo },
        ),
      requestReviewers: (auth, owner, repo, pullNumber, reviewers) =>
        clients.withInstallationClient(
          auth,
          "github.reviews.requestReviewers",
          async (client) => {
            const response = await client.rest.pulls.requestReviewers({
              owner,
              repo,
              pull_number: pullNumber,
              reviewers,
            });
            return toPullRequest(response.data);
          },
          { owner, pullNumber, repo },
        ),
      submitPullRequestReview: (auth, owner, repo, pullNumber, input) =>
        clients.withInstallationClient(
          auth,
          "github.reviews.submitPullRequestReview",
          async (client) => {
            const response = await client.rest.pulls.createReview({
              owner,
              repo,
              pull_number: pullNumber,
              event: input.event,
              body: input.body,
              commit_id: input.commitId,
              comments: input.comments?.map((comment) => ({
                path: comment.path,
                body: comment.body,
                line: comment.line,
                side: comment.side,
              })),
            });
            return toReview(response.data);
          },
          { owner, pullNumber, repo },
        ),
    };
  }),
}) {
  static readonly layer = Layer.effect(this)(this.make).pipe(
    Layer.provide(GitHubClientService.layer),
  );
}

export function listIssueComments(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  issueNumber: number,
): Effect.Effect<GitHubIssueComment[], GitHubError, GitHubReviewsService> {
  return GitHubReviewsService.use((service) =>
    service.listIssueComments(auth, owner, repo, issueNumber),
  );
}

export function createIssueComment(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Effect.Effect<GitHubIssueComment, GitHubError, GitHubReviewsService> {
  return GitHubReviewsService.use((service) =>
    service.createIssueComment(auth, owner, repo, issueNumber, body),
  );
}

export function listPullRequestReviews(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  pullNumber: number,
): Effect.Effect<GitHubPullRequestReview[], GitHubError, GitHubReviewsService> {
  return GitHubReviewsService.use((service) =>
    service.listPullRequestReviews(auth, owner, repo, pullNumber),
  );
}

export function listPullRequestReviewComments(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  pullNumber: number,
): Effect.Effect<GitHubPullRequestReviewComment[], GitHubError, GitHubReviewsService> {
  return GitHubReviewsService.use((service) =>
    service.listPullRequestReviewComments(auth, owner, repo, pullNumber),
  );
}

export function submitPullRequestReview(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  pullNumber: number,
  input: {
    event: GitHubReviewEvent;
    body?: string;
    commitId?: string;
    comments?: GitHubReviewCommentDraft[];
  },
): Effect.Effect<GitHubPullRequestReview, GitHubError, GitHubReviewsService> {
  return GitHubReviewsService.use((service) =>
    service.submitPullRequestReview(auth, owner, repo, pullNumber, input),
  );
}

export function requestReviewers(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  pullNumber: number,
  reviewers: string[],
): Effect.Effect<GitHubPullRequest, GitHubError, GitHubReviewsService> {
  return GitHubReviewsService.use((service) =>
    service.requestReviewers(auth, owner, repo, pullNumber, reviewers),
  );
}

export function removeReviewers(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  pullNumber: number,
  reviewers: string[],
): Effect.Effect<GitHubPullRequest, GitHubError, GitHubReviewsService> {
  return GitHubReviewsService.use((service) =>
    service.removeReviewers(auth, owner, repo, pullNumber, reviewers),
  );
}
