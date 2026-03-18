import * as React from "react";

import { cn } from "../../lib/utils";

function PanelHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="panel-header"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-sachi-line bg-sachi-fill px-3 py-2",
        className
      )}
      {...props}
    />
  );
}

function PanelHeaderLeading({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="panel-header-leading"
      className={cn("flex min-w-0 items-center gap-2", className)}
      {...props}
    />
  );
}

function PanelHeaderTrailing({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="panel-header-trailing"
      className={cn("flex shrink-0 items-center gap-2", className)}
      {...props}
    />
  );
}

export { PanelHeader, PanelHeaderLeading, PanelHeaderTrailing };
