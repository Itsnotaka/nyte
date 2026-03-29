import type { GitHubInstallation } from "@sachikit/github";

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
