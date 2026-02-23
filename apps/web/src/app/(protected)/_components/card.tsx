"use client";

import type { WorkItem } from "@nyte/domain/triage";
import { Badge } from "@nyte/ui/components/badge";
import { Button } from "@nyte/ui/components/button";
import {
  Card as UICard,
  CardContent,
  CardFooter,
  CardHeader as UICardHeader,
  CardTitle,
} from "@nyte/ui/components/card";
import { Separator } from "@nyte/ui/components/separator";
import { Spinner } from "@nyte/ui/components/spinner";
import { cn } from "@nyte/ui/lib/utils";

type CardFrameProps = React.ComponentProps<typeof UICard>;

type CardHeaderProps = {
  actor: string;
  source: WorkItem["source"];
  summary: string;
  gates: WorkItem["gates"];
};

type CardPreviewProps = {
  label: string;
  value: string;
};

type CardActionsProps = {
  primaryLabel: string;
  secondaryLabel: string;
  onPrimaryClick: () => void;
  onSecondaryClick: () => void;
  disabled?: boolean;
  isPending?: boolean;
};

function Frame({ className, ...props }: CardFrameProps) {
  return (
    <UICard
      size="sm"
      className={cn(
        "border-[var(--color-border-subtle)] bg-[var(--color-main-bg)]",
        className
      )}
      {...props}
    />
  );
}

function Header({ actor, source, summary, gates }: CardHeaderProps) {
  return (
    <UICardHeader className="gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{source}</Badge>
        <Badge variant="secondary">{actor}</Badge>
        {gates.map((gate) => (
          <Badge key={gate} variant="ghost" className="capitalize">
            {gate}
          </Badge>
        ))}
      </div>
      <CardTitle className="text-sm leading-5">{summary}</CardTitle>
    </UICardHeader>
  );
}

function Preview({ label, value }: CardPreviewProps) {
  return (
    <CardContent className="space-y-2">
      <Separator />
      <div className="space-y-1.5">
        <p className="text-xs font-medium tracking-wide text-[var(--color-text-tertiary)] uppercase">
          {label}
        </p>
        <p className="text-sm text-[var(--color-text-secondary)]">{value}</p>
      </div>
    </CardContent>
  );
}

function Actions({
  primaryLabel,
  secondaryLabel,
  onPrimaryClick,
  onSecondaryClick,
  disabled = false,
  isPending = false,
}: CardActionsProps) {
  return (
    <CardFooter className="flex justify-end gap-2 border-t border-[var(--color-border-subtle)] bg-[var(--color-inset-bg)]">
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={onSecondaryClick}
      >
        {secondaryLabel}
      </Button>
      <Button size="sm" disabled={disabled} onClick={onPrimaryClick}>
        {isPending ? (
          <span className="inline-flex items-center gap-1.5">
            <Spinner className="size-3.5" />
            Processing
          </span>
        ) : (
          primaryLabel
        )}
      </Button>
    </CardFooter>
  );
}

export const Card = {
  Frame,
  Header,
  Preview,
  Actions,
};
