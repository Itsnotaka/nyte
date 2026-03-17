"use client";

import { Badge } from "@sachikit/ui/components/badge";
import { Checkbox } from "@sachikit/ui/components/checkbox";
import { Input } from "@sachikit/ui/components/input";
import { cn } from "@sachikit/ui/lib/utils";
import * as React from "react";

type FileEntry = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
};

type StatusFilter = "all" | "added" | "modified" | "removed" | "renamed";

type FileTreeSidebarProps = {
  files: FileEntry[];
  viewedFiles: Set<string>;
  activeFile: string | null;
  onFileSelect: (filename: string) => void;
  onToggleViewed: (filename: string, viewed: boolean) => void;
};

const STATUS_LABEL: Record<string, string> = {
  added: "A", new: "A",
  removed: "D", deleted: "D",
  modified: "M", changed: "M", change: "M",
  renamed: "R", "rename-pure": "R", "rename-changed": "R",
};

const STATUS_COLOR: Record<string, string> = {
  added: "text-green-600", new: "text-green-600",
  removed: "text-red-500", deleted: "text-red-500",
  modified: "text-amber-500", changed: "text-amber-500", change: "text-amber-500",
  renamed: "text-blue-500", "rename-pure": "text-blue-500", "rename-changed": "text-blue-500",
};

const FILTER_STATUSES: Record<Exclude<StatusFilter, "all">, Set<string>> = {
  added: new Set(["added", "new"]),
  modified: new Set(["modified", "changed", "change"]),
  removed: new Set(["removed", "deleted"]),
  renamed: new Set(["renamed", "rename-pure", "rename-changed"]),
};

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "added", label: "Added" },
  { id: "modified", label: "Modified" },
  { id: "removed", label: "Removed" },
  { id: "renamed", label: "Renamed" },
];

export function FileTreeSidebar({
  files,
  viewedFiles,
  activeFile,
  onFileSelect,
  onToggleViewed,
}: FileTreeSidebarProps) {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<StatusFilter>("all");

  const filtered = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    const parts = q.length > 0 ? q.split(/\s+/) : [];
    return files.filter((file) => {
      if (filter !== "all" && !FILTER_STATUSES[filter].has(file.status)) return false;
      if (parts.length === 0) return true;
      const lower = file.filename.toLowerCase();
      return parts.every((p) => lower.includes(p));
    });
  }, [files, filter, query]);

  const viewedCount = files.filter((f) => viewedFiles.has(f.filename)).length;

  return (
    <div className="hidden w-72 shrink-0 flex-col border-r border-sachi-line bg-sachi-sidebar lg:flex">
      <div className="space-y-2 border-b border-sachi-line-subtle px-3 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-sachi-fg-muted">
            Files
          </span>
          <span className="text-xs text-sachi-fg-faint">
            {viewedCount}/{files.length} viewed
          </span>
        </div>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search files..."
          className="h-7 text-xs"
        />
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded px-1.5 py-0.5 text-xs transition-colors",
                filter === f.id
                  ? "bg-sachi-fill text-sachi-fg"
                  : "text-sachi-fg-muted hover:bg-sachi-fill hover:text-sachi-fg-secondary",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-xs text-sachi-fg-muted">
            No files match.
          </p>
        ) : (
          filtered.map((file) => {
            const viewed = viewedFiles.has(file.filename);
            const active = activeFile === file.filename;
            const lastSlash = file.filename.lastIndexOf("/");
            const dir = lastSlash > 0 ? file.filename.slice(0, lastSlash) : "";
            const name = lastSlash >= 0 ? file.filename.slice(lastSlash + 1) : file.filename;

            return (
              <div
                key={file.filename}
                className={cn(
                  "group flex items-start gap-2 border-b border-sachi-line-subtle px-3 py-2 transition-colors hover:bg-sachi-fill",
                  active && "bg-sachi-fill",
                )}
              >
                <Checkbox
                  checked={viewed}
                  onCheckedChange={(checked) =>
                    onToggleViewed(file.filename, checked === true)
                  }
                  className="mt-0.5 shrink-0"
                  aria-label={`Mark ${file.filename} as viewed`}
                />
                <button
                  type="button"
                  className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
                  onClick={() => onFileSelect(file.filename)}
                >
                  <span className="flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-4 shrink-0 px-1 text-[10px] font-bold",
                        STATUS_COLOR[file.status] ?? "text-sachi-fg-muted",
                      )}
                    >
                      {STATUS_LABEL[file.status] ?? "?"}
                    </Badge>
                    <span
                      className={cn(
                        "truncate text-xs font-medium",
                        viewed
                          ? "text-sachi-fg-muted"
                          : "text-sachi-fg",
                      )}
                      title={file.filename}
                    >
                      {name}
                    </span>
                  </span>
                  {dir ? (
                    <span className="truncate text-[10px] text-sachi-fg-faint" title={dir}>
                      {dir}
                    </span>
                  ) : null}
                </button>
                <span className="shrink-0 pt-0.5 text-[10px] whitespace-nowrap">
                  <span className="text-green-600">+{file.additions}</span>
                  {" "}
                  <span className="text-red-500">-{file.deletions}</span>
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
