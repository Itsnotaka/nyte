import { Layer } from "effect";

import { GitHubBranchesService } from "./branches.ts";
import { GitHubChecksService } from "./checks.ts";
import { GitHubClientService } from "./client.ts";
import { GitHubInstallationsService } from "./installations.ts";
import { GitHubLabelsService } from "./labels.ts";
import { GitHubPullRequestsService } from "./pull-requests.ts";
import { GitHubRepositoriesService } from "./repositories.ts";
import { GitHubReviewsService } from "./reviews.ts";

export const GitHubServiceLayer = Layer.mergeAll(
  GitHubClientService.layer,
  GitHubInstallationsService.layer,
  GitHubRepositoriesService.layer,
  GitHubBranchesService.layer,
  GitHubChecksService.layer,
  GitHubPullRequestsService.layer,
  GitHubReviewsService.layer,
  GitHubLabelsService.layer,
);
