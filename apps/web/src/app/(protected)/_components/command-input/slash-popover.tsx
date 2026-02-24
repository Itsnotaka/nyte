"use client";

import { cn } from "@nyte/ui/lib/utils";

export type CommandSuggestionItem =
  | {
      id: string;
      type: "contact";
      group: "Contacts";
      label: string;
      description: string;
      contactId: string;
      email: string;
      display: string;
    }
  | {
      id: string;
      type: "command";
      group: "Commands";
      label: string;
      description: string;
      trigger: string;
    };

type SlashPopoverProps = {
  open: boolean;
  x: number;
  y: number;
  items: CommandSuggestionItem[];
  activeIndex: number;
  onSelect: (item: CommandSuggestionItem) => void;
  onHoverIndex: (index: number) => void;
  emptyState?: {
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
  };
};

function groupedItems(items: CommandSuggestionItem[]) {
  const map = new Map<string, CommandSuggestionItem[]>();
  for (const item of items) {
    if (!map.has(item.group)) {
      map.set(item.group, []);
    }
    map.get(item.group)?.push(item);
  }
  return [...map.entries()];
}

export function SlashPopover(props: SlashPopoverProps) {
  if (!props.open) {
    return null;
  }

  let itemOffset = 0;
  const sections = groupedItems(props.items).map(([groupName, items]) => {
    const baseOffset = itemOffset;
    itemOffset += items.length;
    return {
      groupName,
      items,
      baseOffset,
    };
  });

  return (
    <div
      className="z-50 w-80 overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-main-bg)] shadow-xl"
      style={{
        position: "fixed",
        left: props.x,
        top: props.y,
      }}
    >
      {props.items.length === 0 ? (
        <div className="px-2 py-2">
          <p className="text-sm text-[var(--color-text-primary)]">
            {props.emptyState?.title ?? "No suggestions."}
          </p>
          {props.emptyState?.description ? (
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              {props.emptyState.description}
            </p>
          ) : null}
          {props.emptyState?.actionLabel && props.emptyState.onAction ? (
            <button
              type="button"
              className="mt-2 text-xs text-[var(--color-text-secondary)] underline underline-offset-2"
              onMouseDown={(event) => {
                event.preventDefault();
                props.emptyState?.onAction?.();
              }}
            >
              {props.emptyState.actionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
      {sections.map((section) => (
        <div key={section.groupName} className="py-1">
          <p className="px-2 py-1 text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)]">
            {section.groupName}
          </p>
          <ul>
            {section.items.map((item, index) => {
              const absoluteIndex = section.baseOffset + index;
              const isActive = absoluteIndex === props.activeIndex;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={cn(
                      "w-full px-2 py-1.5 text-left",
                      "hover:bg-[var(--color-inset-bg)]",
                      isActive ? "bg-[var(--color-inset-bg)]" : ""
                    )}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      props.onSelect(item);
                    }}
                    onMouseEnter={() => {
                      props.onHoverIndex(absoluteIndex);
                    }}
                  >
                    <p className="text-sm text-[var(--color-text-primary)]">
                      {item.label}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {item.description}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
