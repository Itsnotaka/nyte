import { redirect } from "next/navigation";
import {
  createSearchParamsCache,
  parseAsInteger,
  parseAsString,
  type SearchParams,
} from "nuqs/server";

import { getOnboardingState } from "~/lib/github/server";

import { ConnectView } from "./_components/connect-view";
import { SetupRedirectView } from "./_components/setup-redirect-view";

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
    case "no_session":
      redirect("/login");
    case "no_github_token":
    case "no_installation": {
      const { installation_id, setup_action } = await setupSearchParamsCache.parse(searchParams);

      if (installation_id !== null || setup_action !== null) {
        return <SetupRedirectView />;
      }

      return <ConnectView />;
    }
    case "has_installations":
      redirect("/setup/repos");
  }
}
