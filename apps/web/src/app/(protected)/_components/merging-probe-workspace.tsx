"use client";

import { Badge } from "@sachikit/ui/components/badge";
import { ScrollArea } from "@sachikit/ui/components/scroll-area";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { MergingProbePane, type ProbeSnap } from "./merging-probe-pane";

type State = Record<ProbeSnap["mode"], ProbeSnap>;

const INIT: State = {
  graphql: {
    data: undefined,
    done: false,
    empty: false,
    mode: "graphql",
  },
  rest: {
    data: undefined,
    done: false,
    empty: false,
    mode: "rest",
  },
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-sachi-line-subtle bg-sachi-fill px-3 py-1.5 text-xs font-medium text-sachi-fg-secondary">
      <span className="text-sachi-fg-faint">{label}</span>
      <span className="ml-1.5 text-sachi-fg tabular-nums">{value}</span>
    </div>
  );
}

export function MergingProbeWorkspace() {
  const router = useRouter();
  const [state, setState] = useState(INIT);
  const rest = state.rest.data?.diagnostics;
  const gql = state.graphql.data?.diagnostics;
  const diff = rest && gql ? rest.serverMs - gql.serverMs : null;
  const lead = diff == null || diff === 0 ? null : diff > 0 ? "GraphQL" : "REST";

  const push = useCallback((snap: ProbeSnap) => {
    setState((state) => {
      const prev = state[snap.mode];
      if (prev.data === snap.data && prev.done === snap.done && prev.empty === snap.empty) {
        return state;
      }

      return {
        ...state,
        [snap.mode]: snap,
      };
    });
  }, []);

  useEffect(() => {
    if (!state.rest.done || !state.graphql.done) {
      return;
    }

    if (!state.rest.empty || !state.graphql.empty) {
      return;
    }

    router.replace("/setup");
  }, [router, state]);

  return (
    <ScrollArea className="h-full min-h-0 bg-sachi-base">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-6">
        <header className="rounded-3xl border border-sachi-line-subtle/70 bg-linear-to-br from-sachi-surface via-sachi-surface to-sachi-fill/40 px-6 py-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl space-y-3">
              <Badge
                variant="secondary"
                className="rounded-full bg-sachi-fill px-2.5 py-0.5 text-xs"
              >
                Inbox rule: merging
              </Badge>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-sachi-fg">
                  REST vs GraphQL probe
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-sachi-fg-muted">
                  Side-by-side results for the exact{" "}
                  <code className="rounded bg-sachi-fill px-1.5 py-0.5 text-xs">
                    Merging and recently merged
                  </code>{" "}
                  inbox rule, with each probe isolated so one side can load and paint without
                  waiting on the other.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Stat label="REST items" value={rest ? String(rest.itemCount) : "--"} />
              <Stat label="GraphQL items" value={gql ? String(gql.itemCount) : "--"} />
              <Stat
                label={lead ? `${lead} lead` : "Server delta"}
                value={diff == null ? "--" : `${Math.abs(diff)}ms`}
              />
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-2">
          <MergingProbePane label="REST" mode="rest" push={push} />
          <MergingProbePane label="GraphQL" mode="graphql" push={push} />
        </div>
      </div>
    </ScrollArea>
  );
}
