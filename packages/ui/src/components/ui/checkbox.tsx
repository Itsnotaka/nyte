"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import {
  IconCheckmark1,
  IconMinusSmall,
} from "@central-icons-react/round-outlined-radius-2-stroke-1.5";
import * as React from "react";

import { cn } from "../../lib/utils";

/**
 * Checkbox Component
 *
 * A checkbox component with support for checked, unchecked, and indeterminate
 * states. Based on Cloudflare Kumo design patterns using sachi tokens.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Checkbox checked={isChecked} onCheckedChange={setIsChecked} />
 *
 * // With aria-label for accessibility
 * <Checkbox aria-label="Select all items" />
 *
 * // Indeterminate state (for "select all" with partial selection)
 * <Checkbox checked="indeterminate" />
 *
 * // Error variant
 * <Checkbox variant="error" />
 * ```
 */

/**
 * Visual variant definitions for checkbox.
 */
export const CHECKBOX_VARIANTS = {
  variant: {
    default: {
      classes: "ring-sachi-line hover:ring-sachi-focus focus-visible:ring-sachi-focus",
      description: "Default checkbox appearance",
    },
    error: {
      classes: "ring-destructive hover:ring-destructive focus-visible:ring-destructive",
      description: "Error state for validation failures",
    },
  },
} as const;

export type CheckboxVariant = keyof typeof CHECKBOX_VARIANTS.variant;

/**
 * Props for the Checkbox component.
 */
export interface CheckboxProps extends Omit<
  React.ComponentProps<typeof CheckboxPrimitive.Root>,
  "onChange"
> {
  /** Visual variant - "default" or "error" for validation failures */
  variant?: CheckboxVariant;
}

/**
 * Checkbox component with sachi styling.
 *
 * Supports checked, unchecked, and indeterminate states. Uses ring-based
 * styling with sachi design tokens.
 *
 * @param props - Checkbox props including variant
 * @returns The checkbox component
 */
function Checkbox({ className, variant = "default", ...props }: CheckboxProps) {
  const variantClasses = CHECKBOX_VARIANTS.variant[variant].classes;

  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      data-variant={variant}
      className={cn(
        // Base styles
        "relative flex size-4 shrink-0 items-center justify-center rounded-sm",
        "bg-sachi-base ring-1",
        // Variant styles
        variantClasses,
        // Checked/Indeterminate states - use sachi accent colors
        "data-[checked]:bg-sachi-accent data-[checked]:ring-sachi-accent",
        "data-[indeterminate]:bg-sachi-accent data-[indeterminate]:ring-sachi-accent",
        // Disabled state
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Touch target expansion (invisible hit area)
        "after:absolute after:-inset-x-3 after:-inset-y-2",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        keepMounted
        className="flex items-center justify-center text-sachi-fg data-[unchecked]:invisible"
        render={(renderProps, state) => (
          <span {...renderProps}>
            {state.indeterminate ? (
              <IconMinusSmall className="size-3.5" />
            ) : (
              <IconCheckmark1 className="size-3.5" />
            )}
          </span>
        )}
      />
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
export type { CheckboxPrimitive };
