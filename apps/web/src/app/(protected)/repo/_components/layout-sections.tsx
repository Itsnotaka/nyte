import { cn } from "@sachikit/ui/lib/utils";
import * as React from "react";

type SectionProps = {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function Section({ title, action, children, className }: SectionProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-sachi-fg">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

type SidebarSectionProps = {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
};

export function SidebarSection({ title, children, action }: SidebarSectionProps) {
  return (
    <div className="space-y-2 border-b border-sachi-line-subtle px-3 py-3 last:border-b-0">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium tracking-wide text-sachi-fg-muted uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}
