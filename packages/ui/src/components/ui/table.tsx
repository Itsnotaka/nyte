"use client";

import * as React from "react";

import { cn } from "../../lib/utils";
import { Checkbox } from "./checkbox";

/**
 * Table Component
 *
 * A table component for displaying tabular data with support for selection,
 * row variants, and column sizing. Based on Cloudflare Kumo design patterns.
 *
 * @example
 * ```tsx
 * <Table>
 *   <Table.Header>
 *     <Table.Row>
 *       <Table.Head>Subject</Table.Head>
 *       <Table.Head>From</Table.Head>
 *       <Table.Head>Date</Table.Head>
 *     </Table.Row>
 *   </Table.Header>
 *   <Table.Body>
 *     <Table.Row>
 *       <Table.Cell>Kumo v1.0.0 released</Table.Cell>
 *       <Table.Cell>Visal In</Table.Cell>
 *       <Table.Cell>5 seconds ago</Table.Cell>
 *     </Table.Row>
 *   </Table.Body>
 * </Table>
 * ```
 */

/**
 * Props for the root Table component.
 */
interface TableProps extends React.ComponentProps<"table"> {
  /** Table layout algorithm - auto or fixed */
  layout?: "auto" | "fixed";
  /** Visual variant for the table */
  variant?: "default" | "selected";
}

/**
 * Root table component. Renders a semantic `<table>` element.
 *
 * @param props - Table props including layout and variant options
 * @returns The table element
 */
function Table({ className, layout = "auto", variant, ...props }: TableProps) {
  return (
    <table
      data-slot="table"
      data-layout={layout}
      data-variant={variant}
      className={cn(
        "w-full caption-bottom text-sm",
        layout === "fixed" && "table-fixed",
        className
      )}
      {...props}
    />
  );
}

/**
 * Props for Table.Header component.
 */
interface TableHeaderProps extends React.ComponentProps<"thead"> {
  /** Compact header variant for denser spacing */
  variant?: "default" | "compact";
}

/**
 * Table header section. Renders `<thead>`.
 *
 * @param props - Header props including variant for compact style
 * @returns The thead element
 */
function TableHeader({
  className,
  variant = "default",
  ...props
}: TableHeaderProps) {
  return (
    <thead
      data-slot="table-header"
      data-variant={variant}
      className={cn(
        "border-b border-sachi-line",
        variant === "compact" && "[&_tr]:h-8",
        variant === "default" && "[&_tr]:h-10",
        className
      )}
      {...props}
    />
  );
}

/**
 * Table body section. Renders `<tbody>`.
 *
 * @param props - Standard tbody props
 * @returns The tbody element
 */
function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

/**
 * Props for Table.Row component.
 */
interface TableRowProps extends React.ComponentProps<"tr"> {
  /** Visual variant - selected highlights the row */
  variant?: "default" | "selected";
}

/**
 * Table row. Supports variant="selected" for highlighting.
 *
 * @param props - Row props including variant for selection state
 * @returns The tr element
 */
function TableRow({ className, variant = "default", ...props }: TableRowProps) {
  return (
    <tr
      data-slot="table-row"
      data-variant={variant}
      className={cn(
        "border-b border-sachi-line-subtle transition-colors",
        variant === "selected" && "bg-sachi-fill",
        variant === "default" && "hover:bg-sachi-fill-hover",
        className
      )}
      {...props}
    />
  );
}

/**
 * Header cell. Renders `<th>`.
 *
 * @param props - Standard th props
 * @returns The th element
 */
function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "px-3 text-left align-middle font-medium whitespace-nowrap text-sachi-fg-secondary",
        "[&:has([role=checkbox])]:w-10 [&:has([role=checkbox])]:pr-0 [&:has([role=checkbox])]:pl-3",
        className
      )}
      {...props}
    />
  );
}

/**
 * Body cell. Renders `<td>`.
 *
 * @param props - Standard td props
 * @returns The td element
 */
function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-3 py-2.5 align-middle whitespace-nowrap text-sachi-fg",
        "[&:has([role=checkbox])]:w-10 [&:has([role=checkbox])]:pr-0 [&:has([role=checkbox])]:pl-3",
        className
      )}
      {...props}
    />
  );
}

/**
 * Props for Table.CheckHead component.
 */
interface TableCheckHeadProps extends Omit<
  React.ComponentProps<"th">,
  "onChange"
> {
  /** Whether the checkbox is checked */
  checked?: boolean;
  /** Whether the checkbox is in indeterminate state */
  indeterminate?: boolean;
  /** Callback when checkbox state changes */
  onChange?: (checked: boolean) => void;
  /** Accessible label for the checkbox */
  "aria-label"?: string;
}

/**
 * Header cell with checkbox for "select all" functionality.
 *
 * @param props - Checkbox head props
 * @returns The th element containing a checkbox
 */
function TableCheckHead({
  className,
  checked,
  indeterminate,
  onChange,
  "aria-label": ariaLabel = "Select all rows",
  ...props
}: TableCheckHeadProps) {
  return (
    <th
      data-slot="table-check-head"
      className={cn("w-10 px-3 py-2 text-left align-middle", className)}
      {...props}
    >
      <Checkbox
        checked={checked}
        indeterminate={indeterminate}
        onCheckedChange={onChange}
        aria-label={ariaLabel}
      />
    </th>
  );
}

/**
 * Props for Table.CheckCell component.
 */
interface TableCheckCellProps extends Omit<
  React.ComponentProps<"td">,
  "onChange"
> {
  /** Whether the checkbox is checked */
  checked?: boolean;
  /** Callback when checkbox state changes */
  onChange?: (checked: boolean) => void;
  /** Accessible label for the checkbox */
  "aria-label"?: string;
}

/**
 * Body cell with checkbox for row selection.
 *
 * @param props - Checkbox cell props
 * @returns The td element containing a checkbox
 */
function TableCheckCell({
  className,
  checked,
  onChange,
  "aria-label": ariaLabel = "Select row",
  ...props
}: TableCheckCellProps) {
  return (
    <td
      data-slot="table-check-cell"
      className={cn("w-10 px-3 py-2 align-middle", className)}
      {...props}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={onChange}
        aria-label={ariaLabel}
      />
    </td>
  );
}

/**
 * Props for Table.ResizeHandle component.
 */
interface TableResizeHandleProps extends React.ComponentProps<"div"> {
  /** Mouse down handler for resize start */
  onMouseDown?: (e: React.MouseEvent) => void;
  /** Touch start handler for resize start */
  onTouchStart?: (e: React.TouchEvent) => void;
}

/**
 * Draggable handle for column resizing.
 * Use with TanStack Table or custom resize logic.
 *
 * @param props - Resize handle props
 * @returns The resize handle div element
 */
function TableResizeHandle({
  className,
  onMouseDown,
  onTouchStart,
  ...props
}: TableResizeHandleProps) {
  return (
    <div
      data-slot="table-resize-handle"
      role="separator"
      aria-orientation="vertical"
      className={cn(
        "absolute top-0 right-0 h-full w-1 cursor-col-resize touch-none",
        "hover:bg-sachi-accent/20 active:bg-sachi-accent/40",
        className
      )}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      {...props}
    />
  );
}

/**
 * Assign subcomponents to Table for compound component pattern.
 */
Table.Header = TableHeader;
Table.Body = TableBody;
Table.Row = TableRow;
Table.Head = TableHead;
Table.Cell = TableCell;
Table.CheckHead = TableCheckHead;
Table.CheckCell = TableCheckCell;
Table.ResizeHandle = TableResizeHandle;

export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCheckHead,
  TableCheckCell,
  TableResizeHandle,
};
export type {
  TableProps,
  TableHeaderProps,
  TableRowProps,
  TableCheckHeadProps,
  TableCheckCellProps,
  TableResizeHandleProps,
};
