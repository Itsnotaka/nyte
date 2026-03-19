"use client";

import type { GitHubFileContent } from "@sachikit/github";
import { Badge } from "@sachikit/ui/components/badge";
import { Button } from "@sachikit/ui/components/button";
import {
  PanelHeader,
  PanelHeaderLeading,
  PanelHeaderTrailing,
} from "@sachikit/ui/components/panel-header";

type FileContentViewProps = {
  file: GitHubFileContent;
};

export function FileContentView({ file }: FileContentViewProps) {
  const content = file.encoding === "base64" ? atob(file.content.replace(/\n/g, "")) : file.content;
  const lines = content.split("\n");
  const extension = file.path.includes(".") ? (file.path.split(".").pop() ?? "") : "";
  const size =
    file.size < 1024
      ? `${String(file.size)} B`
      : file.size < 1024 * 1024
        ? `${String(Math.round(file.size / 1024))} KB`
        : `${String(Math.round(file.size / (1024 * 1024)))} MB`;

  return (
    <div className="overflow-hidden rounded-lg border border-sachi-line">
      <PanelHeader>
        <PanelHeaderLeading>
          <h3 className="text-sm font-semibold text-sachi-fg">{file.name}</h3>
          <Badge variant="outline">{size}</Badge>
          {extension ? <Badge variant="outline">{extension}</Badge> : null}
        </PanelHeaderLeading>
        <PanelHeaderTrailing>
          <span className="text-xs text-sachi-fg-faint">
            {lines.length} line{lines.length === 1 ? "" : "s"}
          </span>
          {file.html_url ? (
            <a href={file.html_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                View on GitHub
              </Button>
            </a>
          ) : null}
        </PanelHeaderTrailing>
      </PanelHeader>
      <div className="overflow-x-auto bg-sachi-base">
        <pre className="text-[13px] leading-5">
          <code>
            {lines.map((line, i) => (
              <div key={i} className="flex hover:bg-sachi-fill">
                <span className="inline-block w-12 shrink-0 pr-3 text-right text-sachi-fg-faint select-none">
                  {i + 1}
                </span>
                <span className="flex-1 px-2 break-all whitespace-pre-wrap text-sachi-fg-secondary">
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
