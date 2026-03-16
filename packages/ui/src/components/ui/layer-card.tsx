import * as React from "react";

import { cn } from "../../lib/utils";

function LayerCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="layer-card"
      className={cn(
        "bg-card text-card-foreground ring-foreground/10 flex flex-col gap-1.5 rounded-xl p-1.5 text-sm shadow-xs ring-1",
        className
      )}
      {...props}
    />
  );
}

function LayerCardSecondary({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="layer-card-secondary"
      className={cn(
        "flex items-center justify-between gap-3 px-3.5 pt-2.5 pb-1 text-sm font-medium",
        className
      )}
      {...props}
    />
  );
}

function LayerCardPrimary({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="layer-card-primary"
      className={cn(
        "bg-background ring-border/60 flex flex-col gap-2 rounded-lg border border-border/60 px-3.5 py-3 shadow-xs ring-1",
        className
      )}
      {...props}
    />
  );
}

export { LayerCard, LayerCardSecondary, LayerCardPrimary };
