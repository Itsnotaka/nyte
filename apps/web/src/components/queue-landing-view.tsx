"use client";

import {
  IconArrowRight,
  IconCalendarDays,
  IconEmail1,
  IconSparkle,
  IconWallet1,
} from "@central-icons-react/round-filled-radius-2-stroke-1.5";
import { Alert, AlertDescription, AlertTitle } from "@nyte/ui/components/alert";
import { Badge } from "@nyte/ui/components/badge";
import { Button } from "@nyte/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@nyte/ui/components/card";
import { Spinner } from "@nyte/ui/components/spinner";
import { useMutation } from "@tanstack/react-query";
import { Instrument_Serif } from "next/font/google";

import { authClient } from "~/lib/auth-client";
import { GOOGLE_AUTH_PROVIDER } from "~/lib/auth-provider";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
});

const CONNECTORS = [
  {
    label: "Gmail",
    detail: "Draft response handoff",
    icon: IconEmail1,
  },
  {
    label: "Calendar",
    detail: "Invite approval gates",
    icon: IconCalendarDays,
  },
] as const;

const OUTCOMES = [
  {
    title: "Reply",
    detail: "Review a prepared answer and approve.",
    icon: IconEmail1,
  },
  {
    title: "Schedule",
    detail: "Approve meetings that need your decision.",
    icon: IconCalendarDays,
  },
  {
    title: "Refund",
    detail: "Confirm high-impact reimbursement requests.",
    icon: IconWallet1,
  },
] as const;

export function QueueLandingView() {
  const {
    mutate: connect,
    isPending,
    error,
  } = useMutation({
    mutationFn: () =>
      authClient.signIn.social({
        provider: GOOGLE_AUTH_PROVIDER,
        callbackURL: "/",
      }),
  });

  return (
    <main
      className={`${instrumentSerif.variable} relative min-h-dvh overflow-hidden bg-background text-foreground`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-b from-background via-background to-muted/40"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-28 size-96 rounded-full bg-radial from-primary/30 to-transparent blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -bottom-24 size-96 rounded-full bg-radial from-chart-3/25 to-transparent blur-3xl"
      />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <IconSparkle className="size-3" />
              Nyte
            </Badge>
            <p className="hidden text-xs/5 text-muted-foreground sm:block">
              Decision queue operator interface
            </p>
          </div>
          <Badge variant="outline">v0.1</Badge>
        </header>

        <div className="grid flex-1 items-center gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Card className="animate-in fade-in zoom-in-95 border-border/70 bg-card/75 shadow-xs backdrop-blur-xl duration-500">
            <CardHeader className="gap-4 pb-2">
              <Badge variant="outline" className="w-fit">
                Inbox intelligence
              </Badge>
              <CardTitle
                className="text-4xl/10 tracking-tight sm:text-5xl/12"
                style={{ fontFamily: "var(--font-display), serif" }}
              >
                Focus on decisions, not inbox triage.
              </CardTitle>
              <CardDescription className="text-base/7 text-muted-foreground">
                Connect Google once. Nyte surfaces only the messages and events
                that require your approval.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                {CONNECTORS.map((entry) => {
                  const Icon = entry.icon;
                  return (
                    <Badge
                      key={entry.label}
                      variant="outline"
                      className="gap-1.5"
                    >
                      <Icon className="size-3" />
                      {entry.label}
                    </Badge>
                  );
                })}
              </div>

              {error ? (
                <Alert variant="destructive">
                  <AlertTitle>Connection failed</AlertTitle>
                  <AlertDescription>{error.message}</AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
            <CardFooter className="justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-chart-3" />
                <span className="text-xs/5 text-muted-foreground">
                  System online
                </span>
              </div>
              <Button
                type="button"
                onClick={() => connect()}
                disabled={isPending}
                size="lg"
                className="gap-2"
              >
                {isPending ? <Spinner className="size-3" /> : null}
                {isPending ? "Connecting" : "Continue with Google"}
                <IconArrowRight className="size-3" />
              </Button>
            </CardFooter>
          </Card>

          <div className="flex h-full flex-col gap-4">
            <Card className="animate-in fade-in slide-in-from-right-4 border-border/70 bg-card/70 duration-500">
              <CardHeader className="gap-2 pb-1">
                <CardTitle className="text-sm/6">Connected surfaces</CardTitle>
                <CardDescription className="text-xs/5 text-muted-foreground">
                  Sync channels that feed the approval queue.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {CONNECTORS.map((entry) => {
                  const Icon = entry.icon;
                  return (
                    <div
                      key={entry.label}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <Icon className="size-3.5" />
                        </span>
                        <div className="flex flex-col">
                          <span className="text-sm/6 font-medium">
                            {entry.label}
                          </span>
                          <span className="text-xs/5 text-muted-foreground">
                            {entry.detail}
                          </span>
                        </div>
                      </div>
                      <Badge variant="secondary">Live</Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="animate-in fade-in slide-in-from-right-4 border-border/70 bg-card/70 delay-75 duration-500">
              <CardHeader className="gap-2 pb-1">
                <CardTitle className="text-sm/6">Queue outcomes</CardTitle>
                <CardDescription className="text-xs/5 text-muted-foreground">
                  Each surfaced item resolves into one of these actions.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {OUTCOMES.map((entry) => {
                  const Icon = entry.icon;
                  return (
                    <div key={entry.title} className="flex items-start gap-2">
                      <span className="mt-0.5 flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Icon className="size-3.5" />
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm/6 font-medium">
                          {entry.title}
                        </span>
                        <span className="text-xs/5 text-muted-foreground">
                          {entry.detail}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>

        <footer className="flex flex-wrap items-center gap-2 text-xs/5 text-muted-foreground">
          <span>Review reply</span>
          <span>·</span>
          <span>Accept invite</span>
          <span>·</span>
          <span>Queue refund</span>
        </footer>
      </div>
    </main>
  );
}
