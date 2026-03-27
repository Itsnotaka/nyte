import { redirect } from "next/navigation";

import { getOnboardingState } from "~/lib/github/server";

export default async function App() {
  const state = await getOnboardingState();
  if (state.step !== "has_installations") {
    redirect("/setup");
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col p-6">
      <h1 className="text-lg font-semibold text-sachi-foreground">Home</h1>
      <p className="mt-2 text-sm text-sachi-foreground-muted">
        GitHub App is installed. Connect synced repos from the shell when that flow is available.
      </p>
    </main>
  );
}
