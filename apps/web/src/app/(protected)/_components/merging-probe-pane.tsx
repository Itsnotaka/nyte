"use client";

import {
  IconCircleDashed,
  IconCircleX,
  IconMerged,
} from "@central-icons-react/round-outlined-radius-2-stroke-1.5";
import { Alert, AlertDescription } from "@sachikit/ui/components/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@sachikit/ui/components/avatar";
import { Badge } from "@sachikit/ui/components/badge";
import { Card, CardContent } from "@sachikit/ui/components/card";
import { ScrollArea } from "@sachikit/ui/components/scroll-area";
import { Skeleton } from "@sachikit/ui/components/skeleton";
import { Table } from "@sachikit/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { InboxProbeData, InboxPullRequestRow } from "~/lib/github/server";
import { formatRelativeTime } from "~/lib/time";
import { useTRPC } from "~/lib/trpc/react";

export type ProbeSnap = {
  data: InboxProbeData | null | undefined;
  done: boolean;
  empty: boolean;
  mode: "graphql" | "rest";
};

function useProbeMs(done: boolean) {
  const start = useRef<number | null>(null);
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    if (start.current != null) {
      return;
    }

    start.current = performance.now();
  }, []);

  useEffect(() => {
    if (!done || ms != null || start.current == null) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      setMs(Math.round(performance.now() - start.current!));
    });

    return () => cancelAnimationFrame(frame);
  }, [done, ms]);

  return ms;
}

function Stat({
  label,
  tone = "default",
  value,
}: {
  label: string;
  tone?: "default" | "warn";
  value: string;
}) {
  const cls =
    tone === "warn"
      ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
      : "border-sachi-line-subtle bg-sachi-fill text-sachi-fg-secondary";

  return (
    <div className={`rounded-full border px-3 py-1.5 text-xs font-medium ${cls}`}>
      <span className="text-sachi-fg-faint">{label}</span>
      <span className="ml-1.5 text-sachi-fg tabular-nums">{value}</span>
    </div>
  );
}

function State({ pr }: { pr: InboxPullRequestRow }) {
  if (pr.merged) {
    return (
      <Badge variant="secondary" className="gap-1 rounded-full bg-sachi-fill px-2 py-0.5 text-xs">
        <IconMerged className="size-3 text-sachi-accent" />
        <span>Merged</span>
      </Badge>
    );
  }

  if (pr.state === "open") {
    return (
      <Badge variant="secondary" className="gap-1 rounded-full bg-sachi-fill px-2 py-0.5 text-xs">
        <IconCircleDashed className="size-3 text-sachi-success" />
        <span>Open</span>
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="gap-1 rounded-full bg-sachi-fill px-2 py-0.5 text-xs">
      <IconCircleX className="size-3 text-destructive" />
      <span>Closed</span>
    </Badge>
  );
}

function Row({ pr }: { pr: InboxPullRequestRow }) {
  return (
    <Table.Row>
      <Table.Cell className="w-full min-w-0 pl-4">
        <Link
          href={`/repo/${pr.repoOwner}/${pr.repoName}/pull/${String(pr.number)}`}
          prefetch={false}
          className="flex min-w-0 items-center gap-3 py-2"
        >
          <Avatar size="sm">
            <AvatarImage src={pr.user.avatar_url} alt={pr.user.login} />
            <AvatarFallback>{pr.user.login.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-sachi-fg">{pr.title}</div>
            <div className="truncate text-xs text-sachi-fg-muted">
              {pr.repoFullName} #{pr.number} &middot; {pr.user.login}
            </div>
          </div>
        </Link>
      </Table.Cell>
      <Table.Cell className="w-24 text-right">
        {pr.additions != null && pr.deletions != null ? (
          <span className="text-xs whitespace-nowrap tabular-nums">
            <span className="text-sachi-success">+{pr.additions}</span>
            <span className="text-sachi-fg-faint"> / </span>
            <span className="text-destructive">-{pr.deletions}</span>
          </span>
        ) : (
          <span className="text-xs text-sachi-fg-faint">&mdash;</span>
        )}
      </Table.Cell>
      <Table.Cell className="w-28 text-right">
        <State pr={pr} />
      </Table.Cell>
      <Table.Cell className="w-24 pr-4 text-right text-xs whitespace-nowrap text-sachi-fg-faint">
        {formatRelativeTime(pr.updated_at, { addSuffix: false })}
      </Table.Cell>
    </Table.Row>
  );
}

function TableView({ data }: { data: InboxProbeData }) {
  if (data.items.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center px-6 text-sm text-sachi-fg-muted">
        No pull requests matched this probe.
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[60vh]">
      <Table layout="fixed">
        <Table.Header variant="compact">
          <Table.Row>
            <Table.Head className="w-full pl-4">Pull request</Table.Head>
            <Table.Head className="w-24 text-right">Changes</Table.Head>
            <Table.Head className="w-28 text-right">State</Table.Head>
            <Table.Head className="w-24 pr-4 text-right">Updated</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {data.items.map((pr) => (
            <Row key={pr.id} pr={pr} />
          ))}
        </Table.Body>
      </Table>
    </ScrollArea>
  );
}

function Loading() {
  return (
    <div className="space-y-3 px-5 py-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

function Empty() {
  return (
    <CardContent className="px-5 py-4 text-sm text-sachi-fg-muted">
      Finish GitHub setup to load this probe.
    </CardContent>
  );
}

function Failures({ data }: { data: InboxProbeData }) {
  if (data.diagnostics.partialFailures.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-sachi-line-subtle/60 px-5 py-3">
      <details className="text-sm text-sachi-fg-muted">
        <summary className="cursor-pointer font-medium text-sachi-fg-secondary select-none">
          {data.diagnostics.partialFailures.length} partial failure
          {data.diagnostics.partialFailures.length === 1 ? "" : "s"}
        </summary>
        <ul className="mt-2 space-y-1.5">
          {data.diagnostics.partialFailures.map((item) => (
            <li key={item} className="leading-5 break-words">
              {item}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function MergingProbePane({
  label,
  mode,
  push,
}: {
  label: string;
  mode: "graphql" | "rest";
  push?: (snap: ProbeSnap) => void;
}) {
  const trpc = useTRPC();
  const query = useQuery(
    mode === "graphql"
      ? trpc.github.getMergingProbeGraphql.queryOptions(undefined, {
          gcTime: 5 * 60_000,
          staleTime: 60_000,
          trpc: {
            context: {
              skipBatch: true,
            },
          },
        })
      : trpc.github.getMergingProbeRest.queryOptions(undefined, {
          gcTime: 5 * 60_000,
          staleTime: 60_000,
          trpc: {
            context: {
              skipBatch: true,
            },
          },
        }),
  );
  const ms = useProbeMs(query.status === "success");
  const state =
    query.status === "error"
      ? "error"
      : query.status === "success"
        ? query.data == null
          ? "empty"
          : "ready"
        : "loading";

  useEffect(() => {
    push?.({
      data: query.data,
      done: query.status !== "pending",
      empty: query.status === "success" && query.data == null,
      mode,
    });
  }, [mode, push, query.data, query.status]);

  return (
    <Card
      data-ready={state === "ready" ? "true" : "false"}
      data-source={mode}
      data-state={state}
      className="min-h-[32rem] overflow-hidden border-sachi-line-subtle/70 bg-sachi-surface/95"
    >
      <div className="border-b border-sachi-line-subtle/70 bg-linear-to-br from-sachi-fill/70 to-transparent px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-sachi-fg">{label}</div>
            <div className="text-sm text-sachi-fg-muted">
              Same merging rule, different upstream fetch path.
            </div>
          </div>
          <Badge variant="secondary" className="rounded-full bg-sachi-fill px-2.5 py-0.5 text-xs">
            {mode.toUpperCase()}
          </Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Stat label="Server" value={query.data ? `${query.data.diagnostics.serverMs}ms` : "--"} />
          <Stat label="Render" value={ms != null ? `${ms}ms` : "--"} />
          <Stat
            label="Fetched PRs"
            value={query.data ? String(query.data.diagnostics.fetchedCount) : "--"}
          />
          <Stat
            label="Matched"
            value={query.data ? String(query.data.diagnostics.itemCount) : "--"}
          />
          {query.data && query.data.diagnostics.partialFailures.length > 0 ? (
            <Stat
              label="Failures"
              tone="warn"
              value={String(query.data.diagnostics.partialFailures.length)}
            />
          ) : null}
        </div>
      </div>

      {query.error ? (
        <CardContent className="px-5 py-4">
          <Alert>
            <AlertDescription>{query.error.message}</AlertDescription>
          </Alert>
        </CardContent>
      ) : null}

      {state === "loading" ? <Loading /> : null}
      {state === "empty" ? <Empty /> : null}
      {query.data ? <TableView data={query.data} /> : null}
      {query.data ? <Failures data={query.data} /> : null}
    </Card>
  );
}
