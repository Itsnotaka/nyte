import type { GitHubRepository } from "@sachikit/github";
import { cn } from "@sachikit/ui/lib/utils";
import { Streamdown } from "streamdown";

function resolveMarkdownUrl(url: string, repository: GitHubRepository): string {
  if (
    url.startsWith("#") ||
    url.startsWith("//") ||
    /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(url)
  ) {
    return url;
  }

  try {
    const repositoryUrl = `https://github.com/${repository.owner.login}/${repository.name}/`;
    return new URL(url, repositoryUrl).toString();
  } catch {
    return url;
  }
}

type MarkdownContentProps = {
  content: string | null;
  repository: GitHubRepository;
  emptyFallback?: string;
  className?: string;
};

export function MarkdownContent({
  content,
  repository,
  emptyFallback,
  className,
}: MarkdownContentProps) {
  const markdown = content?.trim() ?? "";

  if (markdown.length === 0) {
    return emptyFallback ? <p className={className}>{emptyFallback}</p> : null;
  }

  return (
    <Streamdown
      className={cn(
        "[&_ol]:list-decimal [&_ol]:pl-4 [&_ul]:list-disc [&_ul]:pl-4",
        "[&_p]:mb-2 [&_p]:last:mb-0",
        className
      )}
      linkSafety={{ enabled: false }}
      mode="static"
      urlTransform={(url) => resolveMarkdownUrl(url, repository)}
    >
      {markdown}
    </Streamdown>
  );
}
