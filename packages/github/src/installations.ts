import { Effect, Layer, ServiceMap } from "effect";

import { accountFromResponse, GitHubClientService } from "./client.ts";
import { type GitHubAccount, type GitHubInstallation } from "./types.ts";
import type { GitHubError } from "./types.ts";

type GitHubInstallationsShape = {
  listUserInstallations: (
    userAccessToken: string,
  ) => Effect.Effect<GitHubInstallation[], GitHubError>;
};

export class GitHubInstallationsService extends ServiceMap.Service<
  GitHubInstallationsService,
  GitHubInstallationsShape
>()("GitHubInstallationsService", {
  make: Effect.gen(function* () {
    const clients = yield* GitHubClientService;
    return {
      listUserInstallations: (userAccessToken) =>
        clients.withUserClient(
          userAccessToken,
          "github.installations.listUserInstallations",
          async (client) => {
            const installations = await client.paginate(
              client.rest.apps.listInstallationsForAuthenticatedUser,
              { per_page: 100 },
            );
            return installations.map((installation) => ({
              id: installation.id,
              account: accountFromResponse(installation.account, "installation"),
              app_slug: installation.app_slug,
              target_type: installation.target_type === "Organization" ? "Organization" : "User",
              permissions: installation.permissions,
              repository_selection: installation.repository_selection,
              created_at: installation.created_at,
            }));
          },
        ),
    };
  }),
}) {
  static readonly layer = Layer.effect(this)(this.make).pipe(
    Layer.provide(GitHubClientService.layer),
  );
}

export function listUserInstallations(
  userAccessToken: string,
): Effect.Effect<GitHubInstallation[], GitHubError, GitHubInstallationsService> {
  return GitHubInstallationsService.use((service) =>
    service.listUserInstallations(userAccessToken),
  );
}

export function getAuthenticatedGitHubAccount(
  userAccessToken: string,
): Effect.Effect<GitHubAccount, GitHubError, GitHubClientService> {
  return GitHubClientService.use((service) =>
    service.withUserClient(
      userAccessToken,
      "github.auth.getAuthenticatedGitHubAccount",
      async (client) => {
        const res = await client.rest.users.getAuthenticated();
        return accountFromResponse(res.data, "authenticated user");
      },
    ),
  );
}

export function getInstallUrl(appSlug: string): string {
  return `https://github.com/apps/${appSlug}/installations/new`;
}

