"use client";

import type { GitHubBranch } from "@sachikit/github";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sachikit/ui/components/select";

type BranchSelectorProps = {
  branches: GitHubBranch[];
  currentRef: string;
  onRefChange: (ref: string) => void;
};

export function BranchSelector({ branches, currentRef, onRefChange }: BranchSelectorProps) {
  function handleChange(value: string | null) {
    if (value) onRefChange(value);
  }

  return (
    <Select value={currentRef} onValueChange={handleChange}>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Select branch" />
      </SelectTrigger>
      <SelectContent>
        {branches.map((branch) => (
          <SelectItem key={branch.name} value={branch.name}>
            {branch.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
