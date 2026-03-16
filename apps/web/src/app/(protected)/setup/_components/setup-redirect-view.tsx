"use client";

import { useRouter } from "next/navigation";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useEffect } from "react";

export function SetupRedirectView() {
  const [{ installation_id, setup_action }] = useQueryStates({
    installation_id: parseAsInteger,
    setup_action: parseAsString,
  });
  const router = useRouter();

  useEffect(() => {
    const redirectTo = setup_action === "install" && installation_id ? "/setup/repos" : "/setup";
    router.replace(redirectTo);
  }, [installation_id, setup_action, router]);

  return (
    <section className="flex h-full items-center justify-center px-4">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-xl font-semibold text-sachi-fg">Finalizing GitHub setup</h1>
          <p className="max-w-sm text-sm text-sachi-fg-muted">
            We&apos;re validating the GitHub app setup and sending you to repository selection.
          </p>
        </div>
      </div>
    </section>
  );
}
