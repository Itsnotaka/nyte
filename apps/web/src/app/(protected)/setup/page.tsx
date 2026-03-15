import { redirect } from "next/navigation";

import { getOnboardingState } from "~/lib/github/server";

import { ConnectView } from "./_components/connect-view";
import { SetupRedirectView } from "./_components/setup-redirect-view";

type SetupPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleSearchParam(
  value: string | string[] | undefined
): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function parseInstallationId(value: string | null): number | null {
  if (!value) return null;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const state = await getOnboardingState();

  switch (state.step) {
    case "no_session":
      redirect("/login");
    case "no_github_token":
      redirect("/login");
    case "no_installation": {
      const params = await searchParams;
      const installationId = parseInstallationId(
        getSingleSearchParam(params.installation_id)
      );
      const setupAction = getSingleSearchParam(params.setup_action);

      if (installationId !== null || setupAction !== null) {
        return (
          <SetupRedirectView
            installationId={installationId}
            setupAction={setupAction}
          />
        );
      }

      return <ConnectView />;
    }
    case "has_installations":
      redirect("/setup/repos");
  }
}
