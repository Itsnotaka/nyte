"use client";

import type { GitHubRepository } from "@sachikit/github";
import { create } from "zustand";

type RepoStoreState = {
  repos: GitHubRepository[];
  totalSynced: number;
  setRepoData: (repos: GitHubRepository[], totalSynced: number) => void;
};

export const useRepoStore = create<RepoStoreState>((set) => ({
  repos: [],
  totalSynced: 0,
  setRepoData: (repos, totalSynced) => set({ repos, totalSynced }),
}));
