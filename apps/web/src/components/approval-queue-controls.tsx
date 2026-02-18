"use client";

import {
  IconArrowsRepeat,
  IconBrokenChainLink2,
  IconZap,
} from "@central-icons-react/round-filled-radius-2-stroke-1.5";
import { Badge } from "@nyte/ui/components/badge";
import { Button } from "@nyte/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nyte/ui/components/card";
import { Input } from "@nyte/ui/components/input";
import { Kbd } from "@nyte/ui/components/kbd";
import { Separator } from "@nyte/ui/components/separator";
import { useForm } from "@tanstack/react-form";

type ApprovalQueueControlsProps = {
  connected: boolean;
  isSyncing: boolean;
  isSessionPending: boolean;
  activeWatchKeywords: string[];
  onSubmit: (command: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
};

export function ApprovalQueueControls({
  connected,
  isSyncing,
  isSessionPending,
  activeWatchKeywords,
  onSubmit,
  onConnect,
  onDisconnect,
}: ApprovalQueueControlsProps) {
  const form = useForm({
    defaultValues: { command: "" },
    onSubmit: async ({ value }) => {
      if (!connected) return;
      onSubmit(value.command);
    },
  });

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 border-border/70 bg-card/70 backdrop-blur-xl duration-300">
      <CardHeader className="gap-2 pb-1">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm/6">Sync controls</CardTitle>
          <Badge variant={connected ? "secondary" : "outline"}>
            {connected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
        <CardDescription className="text-xs/5 text-muted-foreground">
          Use keywords to focus sync on specific senders or topics.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
          className="flex flex-col gap-2"
        >
          <form.Field name="command">
            {(field) => (
              <Input
                id={field.name}
                name={field.name}
                aria-label="Watch keywords for sync"
                placeholder="watch refund, vip"
                className="h-10 text-sm/6"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            )}
          </form.Field>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1 text-xs/5 text-muted-foreground">
              <Kbd>↵</Kbd>
              Submit sync command
            </p>

            <Button
              type="submit"
              disabled={!connected || isSyncing}
              className="min-w-28"
            >
              <IconArrowsRepeat
                className={`size-3.5 ${isSyncing ? "animate-spin" : ""}`}
              />
              {isSyncing ? "Syncing" : "Sync queue"}
            </Button>
          </div>
        </form>

        <Separator />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1 text-xs/5 text-muted-foreground">
            {connected ? (
              <IconZap className="size-3.5" />
            ) : (
              <IconBrokenChainLink2 className="size-3.5" />
            )}
            {connected ? "Google account is active" : "Google account required"}
          </p>

          {connected ? (
            <Button
              type="button"
              variant="outline"
              onClick={onDisconnect}
              disabled={isSessionPending}
            >
              Disconnect
            </Button>
          ) : (
            <Button
              type="button"
              onClick={onConnect}
              disabled={isSessionPending}
            >
              Connect Google
            </Button>
          )}
        </div>

        {activeWatchKeywords.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {activeWatchKeywords.map((keyword, index) => (
              <Badge key={`${keyword}:${index}`} variant="outline">
                {keyword}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs/5 text-muted-foreground">
            No active keyword filters.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
