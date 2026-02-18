"use client";

import { IconArrowRight } from "@central-icons-react/round-filled-radius-2-stroke-1.5";
import { Button } from "@nyte/ui/components/button";
import { Spinner } from "@nyte/ui/components/spinner";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";

import { authClient } from "~/lib/auth-client";
import { GOOGLE_AUTH_PROVIDER } from "~/lib/auth-provider";

export function LoginView() {
  const { mutate: connect, isPending } = useMutation({
    mutationFn: () =>
      authClient.signIn.social({
        provider: GOOGLE_AUTH_PROVIDER,
        callbackURL: "/",
      }),
  });

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background text-foreground">
      <div className="flex w-full max-w-sm flex-col gap-6 px-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-medium tracking-tight">
            Sign in to Nyte
          </h1>
          <p className="text-sm text-muted-foreground">
            Connect your Google account to continue.
          </p>
        </div>

        <Button
          type="button"
          size="lg"
          className="w-full justify-between"
          disabled={isPending}
          onClick={() => connect()}
        >
          Continue with Google
          {isPending ? (
            <Spinner className="size-4" />
          ) : (
            <IconArrowRight className="size-4" />
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          <Link
            href="/"
            className="underline underline-offset-3 hover:text-foreground"
          >
            Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
