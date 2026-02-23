"use client";

import * as React from "react";

import { authClient } from "~/lib/auth-client";
import { GOOGLE_AUTH_PROVIDER } from "~/lib/auth-provider";

export function LoginView() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const signInWithGoogle = React.useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      await authClient.signIn.social({
        provider: GOOGLE_AUTH_PROVIDER,
        callbackURL: "/",
      });
    } catch {
      setError("Unable to sign in with Google right now.");
      setIsLoading(false);
    }
  }, []);

  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border p-6">
        <h1 className="text-lg font-semibold">Sign in</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Continue with Google to access Nyte.
        </p>

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={isLoading}
          className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-md border px-3 text-sm font-medium disabled:opacity-50"
        >
          {isLoading ? "Connecting..." : "Continue with Google"}
        </button>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </div>
    </main>
  );
}
