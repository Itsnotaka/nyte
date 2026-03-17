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

function statusLabel(status: string): string {
  if (status === "added") return "A";
  if (status === "removed") return "D";
  if (status === "modified" || status === "changed") return "M";
  if (status === "renamed") return "R";
  return "?";
}

function statusColor(status: string): string {
  if (status === "added") return "text-green-600";
  if (status === "removed") return "text-red-500";
  if (status === "modified" || status === "changed") return "text-amber-500";
  if (status === "renamed") return "text-blue-500";
  return "text-sachi-fg-muted";
}

function matchesFilter(status: string, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "added") return status === "added";
  if (filter === "modified") return status === "modified" || status === "changed";
  if (filter === "removed") return status === "removed";
  if (filter === "renamed") return status === "renamed";
  return true;
}

function fuzzyMatch(query: string, candidate: string): boolean {
  if (query.length === 0) return true;
  const lower = candidate.toLowerCase();
  const parts = query.toLowerCase().split(/\s+/).filter(Boolean);
  return parts.every((part) => lower.includes(part));
}

function basename(filepath: string): string {
  const segments = filepath.split("/");
  return segments[segments.length - 1] ?? filepath;
}

function dirname(filepath: string): string {
  const segments = filepath.split("/");
  if (segments.length <= 1) return "";
  return segments.slice(0, -1).join("/");
}

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

  const filtered = React.useMemo(
    () =>
      files.filter(
        (file) =>
          matchesFilter(file.status, filter) && fuzzyMatch(query, file.filename),
      ),
    [files, filter, query],
  );

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
            const dir = dirname(file.filename);
            const name = basename(file.filename);

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
                        statusColor(file.status),
                      )}
                    >
                      {statusLabel(file.status)}
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
