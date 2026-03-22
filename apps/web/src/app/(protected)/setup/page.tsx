import { redirect } from "next/navigation";
import {
  createSearchParamsCache,
  parseAsInteger,
  parseAsString,
  type SearchParams,
} from "nuqs/server";

import {
  getGitHubAppInstallUrl,
  getOnboardingState,
  resolveGitHubAppSetupRedirect,
} from "~/lib/github/server";

import { ConnectView } from "./_components/connect-view";
import { ReconnectView } from "./_components/reconnect-view";

export const setupSearchParamsCache = createSearchParamsCache({
  installation_id: parseAsInteger,
  setup_action: parseAsString,
});

type SetupPageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const state = await getOnboardingState();

  switch (state.step) {
    case "no_user_session":
      redirect("/login");
    case "no_github_user_token":
      return <ReconnectView />;
    case "no_github_installation": {
      const { installation_id, setup_action } = await setupSearchParamsCache.parse(searchParams);

      if (installation_id !== null || setup_action !== null) {
        const { redirectTo } = resolveGitHubAppSetupRedirect({
          installationId: installation_id,
          setupAction: setup_action,
        });
        redirect(redirectTo);
      }

      return <ConnectView url={getGitHubAppInstallUrl()} />;
    }
    case "has_installations":
      redirect("/setup/repos");
  }
}
