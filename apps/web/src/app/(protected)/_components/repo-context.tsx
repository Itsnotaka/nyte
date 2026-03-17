"use client";

import type { GitHubInstallation, GitHubRepository } from "@sachikit/github";
import * as React from "react";

type RepoContextValue = {
  installations: GitHubInstallation[];
  repos: GitHubRepository[];
  syncedRepos: GitHubRepository[];
  totalAccessible: number;
  totalSynced: number;
};

const RepoContext = React.createContext<RepoContextValue | null>(null);

export function useRepo() {
  const ctx = React.useContext(RepoContext);
  if (!ctx) {
    throw new Error("useRepo must be used within RepoProvider");
  }
  return ctx;
}

type RepoProviderProps = {
  installations: GitHubInstallation[];
  repos: GitHubRepository[];
  syncedRepos: GitHubRepository[];
  totalAccessible: number;
  totalSynced: number;
  children: React.ReactNode;
};

export function RepoProvider({
  installations,
  repos,
  syncedRepos,
  totalAccessible,
  totalSynced,
  children,
}: RepoProviderProps) {
  const value = React.useMemo(
    () => ({
      installations,
      repos,
      syncedRepos,
      totalAccessible,
      totalSynced,
    }),
    [installations, repos, syncedRepos, totalAccessible, totalSynced]
  );

  return <RepoContext.Provider value={value}>{children}</RepoContext.Provider>;
}
