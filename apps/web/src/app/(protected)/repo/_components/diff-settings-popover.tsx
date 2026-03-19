"use client";

import { IconSettingsSliderHor } from "@central-icons-react/round-outlined-radius-2-stroke-1.5";
import { DIFF_SETTINGS_DEFAULTS } from "@sachikit/db/schema/settings";
import type { DiffSettingsJson } from "@sachikit/db/schema/settings";
import { Button } from "@sachikit/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@sachikit/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sachikit/ui/components/select";
import { Switch } from "@sachikit/ui/components/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { useTRPC } from "~/lib/trpc/react";

function DiffViewOption({
  label,
  selected,
  onSelect,
  children,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-1 flex-col items-center gap-2 rounded-lg border p-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sachi-focus ${
        selected
          ? "border-sachi-accent bg-sachi-fill text-sachi-fg"
          : "border-sachi-line bg-sachi-base text-sachi-fg-secondary hover:border-sachi-line hover:bg-sachi-fill"
      }`}
    >
      <div
        className={`size-3 rounded-full border-2 transition-colors ${selected ? "border-sachi-accent bg-sachi-accent" : "border-sachi-line"}`}
      />
      <div className="flex w-full flex-col gap-1">{children}</div>
      <span>{label}</span>
    </button>
  );
}

function UnifiedPreview() {
  return (
    <div className="flex w-full flex-col gap-0.5">
      <div className="h-1.5 w-full rounded-sm bg-red-200 dark:bg-red-900/50" />
      <div className="h-1.5 w-full rounded-sm bg-green-200 dark:bg-green-900/50" />
      <div className="h-1.5 w-3/4 rounded-sm bg-sachi-rail" />
    </div>
  );
}

function SplitPreview() {
  return (
    <div className="flex w-full gap-0.5">
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="h-1.5 w-full rounded-sm bg-red-200 dark:bg-red-900/50" />
        <div className="h-1.5 w-3/4 rounded-sm bg-sachi-rail" />
      </div>
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="h-1.5 w-full rounded-sm bg-green-200 dark:bg-green-900/50" />
        <div className="h-1.5 w-3/4 rounded-sm bg-sachi-rail" />
      </div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-sachi-fg">{label}</p>
        {description ? <p className="text-xs text-sachi-fg-muted">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function AdvancedSettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-sachi-fg-secondary">{label}</p>
      {children}
    </div>
  );
}

export function DiffSettingsPopover() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const settingsQueryKey = trpc.settings.getDiffSettings.queryKey();

  const settingsQuery = useQuery(trpc.settings.getDiffSettings.queryOptions());
  const settings: DiffSettingsJson = settingsQuery.data ?? DIFF_SETTINGS_DEFAULTS;

  const mutation = useMutation(
    trpc.settings.updateDiffSettings.mutationOptions({
      onMutate: async (newSettings) => {
        await queryClient.cancelQueries({ queryKey: settingsQueryKey });
        const previous = queryClient.getQueryData(settingsQueryKey);
        queryClient.setQueryData(settingsQueryKey, (old: DiffSettingsJson | undefined) => ({
          ...(old ?? DIFF_SETTINGS_DEFAULTS),
          ...newSettings,
        }));
        return { previous };
      },
      onError: (_err, _vars, context) => {
        if (context?.previous !== undefined) {
          queryClient.setQueryData(settingsQueryKey, context.previous);
        }
      },
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: settingsQueryKey });
      },
    }),
  );

  function update(patch: Partial<DiffSettingsJson>) {
    mutation.mutate(patch);
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Diff settings">
            <IconSettingsSliderHor className="size-4" />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Diff settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2.5">
            <p className="text-sm font-medium text-sachi-fg">Preferred diff view</p>
            <div className="flex gap-2">
              <DiffViewOption
                label="Unified"
                selected={settings.diffStyle === "unified"}
                onSelect={() => update({ diffStyle: "unified" })}
              >
                <UnifiedPreview />
              </DiffViewOption>
              <DiffViewOption
                label="Split"
                selected={settings.diffStyle === "split"}
                onSelect={() => update({ diffStyle: "split" })}
              >
                <SplitPreview />
              </DiffViewOption>
            </div>
          </div>

          <div className="h-px bg-sachi-line" />

          <SettingRow
            label="Hide comments"
            description="Press I to show and hide comments anytime."
          >
            <Switch
              checked={settings.hideComments}
              onCheckedChange={(checked) => update({ hideComments: checked })}
            />
          </SettingRow>

          <div className="h-px bg-sachi-line" />

          <div className="space-y-3">
            <p className="text-xs font-medium tracking-wider text-sachi-fg-muted uppercase">
              Advanced diff settings
            </p>

            <AdvancedSettingRow label="Lines above and below changes">
              <Select
                value={String(settings.contextLines)}
                onValueChange={(value) => update({ contextLines: Number(value) })}
              >
                <SelectTrigger size="sm" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 line</SelectItem>
                  <SelectItem value="3">3 lines (default)</SelectItem>
                  <SelectItem value="5">5 lines</SelectItem>
                  <SelectItem value="10">10 lines</SelectItem>
                  <SelectItem value="20">20 lines</SelectItem>
                </SelectContent>
              </Select>
            </AdvancedSettingRow>

            <AdvancedSettingRow label="Line overflow">
              <Select
                value={settings.overflow}
                onValueChange={(value) => update({ overflow: value as "scroll" | "wrap" })}
              >
                <SelectTrigger size="sm" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scroll">Always scroll</SelectItem>
                  <SelectItem value="wrap">Wrap lines</SelectItem>
                </SelectContent>
              </Select>
            </AdvancedSettingRow>

            <AdvancedSettingRow label="Inline diff">
              <Select
                value={settings.lineDiffType}
                onValueChange={(value) =>
                  update({
                    lineDiffType: value as DiffSettingsJson["lineDiffType"],
                  })
                }
              >
                <SelectTrigger size="sm" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="word-alt">Word (default)</SelectItem>
                  <SelectItem value="word">Word (classic)</SelectItem>
                  <SelectItem value="char">Character</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </AdvancedSettingRow>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
