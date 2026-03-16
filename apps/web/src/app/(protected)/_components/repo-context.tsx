"use client";

import type { GitHubInstallation, GitHubRepository } from "@sachikit/github";
import * as React from "react";

type RepoContextValue = {
  installations: GitHubInstallation[];
  repos: GitHubRepository[];
  selectedRepo: GitHubRepository | null;
  setSelectedRepo: (repo: GitHubRepository) => void;
};

const RepoContext = React.createContext<RepoContextValue | null>(null);

export function useRepo() {
  const ctx = React.useContext(RepoContext);
  if (!ctx) {
    throw new Error("useRepo must be used within RepoProvider");
  }
  return ctx;
}

export function useRepoOptional() {
  return React.useContext(RepoContext);
}

type RepoProviderProps = {
  installations: GitHubInstallation[];
  repos: GitHubRepository[];
  children: React.ReactNode;
};

export function RepoProvider({
  installations,
  repos,
  children,
}: RepoProviderProps) {
  const [selectedRepo, setSelectedRepo] =
    React.useState<GitHubRepository | null>(repos[0] ?? null);

  const value = React.useMemo(
    () => ({
      installations,
      repos,
      selectedRepo,
      setSelectedRepo,
    }),
    [installations, repos, selectedRepo]
  );

  return <RepoContext.Provider value={value}>{children}</RepoContext.Provider>;
}
