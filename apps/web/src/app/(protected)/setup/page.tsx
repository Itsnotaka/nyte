import Link from "next/link";
import { redirect } from "next/navigation";

import { getUserSession } from "~/lib/auth/server";
import {
  getGitHubAppInstallUrl,
  getOnboardingState,
  resolveGitHubAppSetupRedirect,
} from "~/lib/github/server";

type SetupPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const session = await getUserSession();
  if (!session) {
    redirect("/login");
  }

  const sp = await searchParams;
  const rawId = sp.installation_id;
  const installationId =
    typeof rawId === "string" && rawId.length > 0 ? Number.parseInt(rawId, 10) : null;
  const setupAction = typeof sp.setup_action === "string" ? sp.setup_action : null;

  const { redirectTo } = resolveGitHubAppSetupRedirect({
    installationId: Number.isFinite(installationId) ? installationId : null,
    setupAction,
  });
  if (redirectTo !== "/setup") {
    redirect(redirectTo);
  }

  const state = await getOnboardingState();
  if (state.step === "has_installations") {
    redirect("/");
  }

  const installUrl = getGitHubAppInstallUrl();

  return (
    <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 p-6">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold text-sachi-foreground">Install GitHub App</h1>
        <p className="mt-2 text-sm text-sachi-foreground-muted">
          Connect the Sachi GitHub App to your account or organization so we can access repositories you
          choose.
        </p>
      </div>
      <a
        href={installUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-10 items-center justify-center rounded-lg bg-[#2563eb] px-5 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8]"
      >
        Install on GitHub
      </a>
      <p className="text-xs text-sachi-foreground-muted">
        After installing, you can{" "}
        <Link href="/" className="text-sachi-foreground underline underline-offset-2">
          return to the app
        </Link>
        .
      </p>
    </main>
  );
}
