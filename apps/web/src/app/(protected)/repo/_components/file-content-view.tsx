"use client";

import type { GitHubFileContent } from "@sachikit/github";
import { Badge } from "@sachikit/ui/components/badge";
import { Button } from "@sachikit/ui/components/button";
import { cn } from "@sachikit/ui/lib/utils";

type FileContentViewProps = {
  file: GitHubFileContent;
  owner: string;
  repo: string;
};

function decodeContent(file: GitHubFileContent): string {
  if (file.encoding === "base64") {
    try {
      return atob(file.content.replace(/\n/g, ""));
    } catch {
      return file.content;
    }
  }
  return file.content;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${String(Math.round(bytes / 1024))} KB`;
  return `${String(Math.round(bytes / (1024 * 1024)))} MB`;
}

function extensionFromPath(path: string): string {
  const parts = path.split(".");
  return parts.length > 1 ? (parts[parts.length - 1] ?? "") : "";
}

export function FileContentView({
  file,
  owner,
  repo,
}: FileContentViewProps) {
  const content = decodeContent(file);
  const lines = content.split("\n");
  const extension = extensionFromPath(file.path);

  return (
    <div className="overflow-hidden rounded-lg border border-sachi-line">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sachi-line bg-sachi-fill px-3 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-sachi-fg">{file.name}</h3>
          <Badge variant="outline">{formatSize(file.size)}</Badge>
          {extension ? (
            <Badge variant="outline">{extension}</Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-sachi-fg-faint">
            {lines.length} line{lines.length === 1 ? "" : "s"}
          </span>
          {file.html_url ? (
            <a
              href={file.html_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                View on GitHub
              </Button>
            </a>
          ) : null}
        </div>
      </div>
      <div className="overflow-x-auto bg-sachi-base">
        <pre className="text-[13px] leading-5">
          <code>
            {lines.map((line, i) => (
              <div key={i} className="flex hover:bg-sachi-fill">
                <span className={cn(
                  "inline-block w-12 shrink-0 select-none pr-3 text-right text-sachi-fg-faint",
                )}>
                  {i + 1}
                </span>
                <span className="flex-1 whitespace-pre-wrap break-all px-2 text-sachi-fg-secondary">
                  {line}
                </span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}
