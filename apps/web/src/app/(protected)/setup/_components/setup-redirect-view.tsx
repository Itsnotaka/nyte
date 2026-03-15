"use client";

import { Button } from "@nyte/ui/components/button";
import { useRouter } from "next/navigation";
import * as React from "react";

import { trpc } from "~/lib/trpc/client";

type SetupRedirectViewProps = {
  installationId: number | null;
  setupAction: string | null;
};

export function SetupRedirectView({
  installationId,
  setupAction,
}: SetupRedirectViewProps) {
  const router = useRouter();
  const { mutate, error, isPending, reset } =
    trpc.github.resolveSetupRedirect.useMutation({
      onSuccess: ({ redirectTo }) => {
        router.replace(redirectTo);
      },
    });

  const resolveSetupRedirect = React.useCallback(() => {
    reset();
    mutate({ installationId, setupAction });
  }, [installationId, mutate, reset, setupAction]);

  React.useEffect(() => {
    resolveSetupRedirect();
  }, [resolveSetupRedirect]);

  return (
    <section className="flex h-full items-center justify-center px-4">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
            Finalizing GitHub setup
          </h1>
          <p className="max-w-sm text-sm text-[var(--color-text-muted)]">
            We&apos;re validating the GitHub app setup and sending you to
            repository selection.
          </p>
        </div>

        {error ? (
          <>
            <p className="text-sm text-red-500">
              {error.message ?? "Unable to finalize GitHub app setup."}
            </p>
            <div className="flex items-center gap-2">
              <Button onClick={resolveSetupRedirect}>Try again</Button>
              <Button variant="outline" onClick={() => router.replace("/setup")}>
                Back to setup
              </Button>
            </div>
          </>
        ) : (
          <Button size="lg" disabled>
            {isPending ? "Loading..." : "Redirecting..."}
          </Button>
        )}
      </div>
    </section>
  );
}
