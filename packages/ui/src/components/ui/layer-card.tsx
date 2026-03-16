import * as React from "react";

import { cn } from "../../lib/utils";

/**
 * LayerCard Component
 *
 * A compound card component with layered visual hierarchy:
 * - LayerCard: Root container with elevated background
 * - LayerCard.Secondary: Header section for titles/actions
 * - LayerCard.Primary: Main content area with distinct background
 *
 * @example
 * ```tsx
 * <LayerCard>
 *   <LayerCard.Secondary>
 *     <span>Card Title</span>
 *   </LayerCard.Secondary>
 *   <LayerCard.Primary>
 *     <p>Card content goes here</p>
 *   </LayerCard.Primary>
 * </LayerCard>
 * ```
 */

/**
 * Root container for the LayerCard component.
 *
 * Provides the outer wrapper with elevated background styling,
 * rounded corners, and subtle shadow. Contains Secondary and Primary
 * sections as children.
 *
 * @param props - Standard div props plus className overrides
 * @returns The root LayerCard container element
 */
function LayerCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="layer-card"
      className={cn(
        "flex flex-col gap-1.5 rounded-xl bg-card p-1.5 text-sm text-card-foreground shadow-xs ring-1 ring-foreground/10",
        className
      )}
      {...props}
    />
  );
}

/**
 * Header section of the LayerCard.
 *
 * Displays title and action elements with medium font weight.
 * Uses flexbox with justify-between for title/action layout.
 *
 * @param props - Standard div props plus className overrides
 * @returns The secondary (header) section element
 */
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

/**
 * Main content area of the LayerCard.
 *
 * Provides a distinct background surface with border and shadow
 * for primary card content. Nested inside the root LayerCard.
 *
 * @param props - Standard div props plus className overrides
 * @returns The primary (content) section element
 */
function LayerCardPrimary({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="layer-card-primary"
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border/60 bg-background px-3.5 py-3 shadow-xs ring-1 ring-border/60",
        className
      )}
      {...props}
    />
  );
}

/**
 * LayerCard compound component exports.
 *
 * LayerCard - Root container
 * LayerCardSecondary - Header section (accessed as LayerCard.Secondary)
 * LayerCardPrimary - Content section (accessed as LayerCard.Primary)
 */
export { LayerCard, LayerCardSecondary, LayerCardPrimary };
