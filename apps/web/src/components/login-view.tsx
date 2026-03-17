"use client";

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
          <h1 className="text-2xl font-semibold tracking-tight text-sachi-fg">
            Sign in to Sachi
          </h1>
          <p className="text-sm text-sachi-fg-muted">
            Connect your GitHub account to get started.
          </p>
        </div>

        <button
          type="button"
          onClick={() => signInMutation.mutate()}
          disabled={signInMutation.isPending}
          className="inline-flex h-10 w-full max-w-xs items-center justify-center gap-2 rounded-lg bg-[#2563eb] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
        >
          <svg
            className="size-4"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          {signInMutation.isPending ? "Connecting..." : "Sign up with GitHub"}
        </button>

        {signInMutation.error ? (
          <p className="text-sm text-red-500">
            {signInMutation.error.message ?? "Unable to sign in with GitHub."}
          </p>
        ) : null}
      </div>
    </main>
  );
}
