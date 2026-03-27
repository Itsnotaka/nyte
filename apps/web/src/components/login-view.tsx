"use client";

import { IconGithubDefault } from "@central-icons-react/round-outlined-radius-2-stroke-1.5";
import { useMutation } from "@tanstack/react-query";

import { authClient } from "~/lib/auth/client";

export function LoginView() {
  const signInMutation = useMutation({
    mutationFn: async () => {
      const result = await authClient.signIn.social({
        provider: "github",
        callbackURL: "/",
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Sign in failed");
      }
      return result.data;
    },
  });

  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-sachi-foreground">Sign in to Sachi</h1>
          <p className="text-sm text-sachi-foreground-muted">Connect your GitHub account to get started.</p>
        </div>

        <button
          type="button"
          onClick={() => signInMutation.mutate()}
          disabled={signInMutation.isPending}
          className="inline-flex h-10 w-full max-w-xs items-center justify-center gap-2 rounded-lg bg-[#2563eb] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
        >
          <IconGithubDefault className="size-4" />
          {signInMutation.isPending ? "Connecting..." : "Sign in with GitHub"}
        </button>

        {signInMutation.error ? (
          <p className="text-sm text-destructive">
            {signInMutation.error.message ?? "Unable to sign in with GitHub."}
          </p>
        ) : null}
      </div>
    </main>
  );
}
