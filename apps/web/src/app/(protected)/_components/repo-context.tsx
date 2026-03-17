"use client";

import type { GitHubRepository } from "@sachikit/github";
import * as React from "react";
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";

type RepoStoreState = {
  repos: GitHubRepository[];
  totalSynced: number;
};

type RepoStore = ReturnType<typeof createRepoStore>;

const RepoStoreContext = React.createContext<RepoStore | null>(null);

function createRepoStore(initialState: RepoStoreState) {
  return createStore<RepoStoreState>(() => initialState);
}

type RepoProviderProps = {
  repos: GitHubRepository[];
  totalSynced: number;
  children: React.ReactNode;
};

export function RepoProvider({
  repos,
  totalSynced,
  children,
}: RepoProviderProps) {
  const storeRef = React.useRef<RepoStore | null>(null);

  if (storeRef.current === null) {
    storeRef.current = createRepoStore({
      repos,
      totalSynced,
    });
  }

  React.useEffect(() => {
    storeRef.current?.setState({
      repos,
      totalSynced,
    });
  }, [repos, totalSynced]);

  return (
    <RepoStoreContext.Provider value={storeRef.current}>
      {children}
    </RepoStoreContext.Provider>
  );
}

export function useRepo<T>(selector: (state: RepoStoreState) => T): T {
  const store = React.useContext(RepoStoreContext);
  if (!store) {
    throw new Error("useRepo must be used within RepoProvider");
  }

  return useStore(store, selector);
}
