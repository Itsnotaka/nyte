"use client";

import { Button } from "@sachikit/ui/components/button";

import { PullRequestView } from "../repo/_components/pull-request-view";

type InboxDetailProps = {
  owner: string;
  repo: string;
  pullNumber: number;
  onClose: () => void;
};

export function InboxDetail({ owner, repo, pullNumber, onClose }: InboxDetailProps) {
  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-sachi-surface">
      <PullRequestView
        owner={owner}
        repo={repo}
        pullNumber={pullNumber}
        close={
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>
            Back to inbox
          </Button>
        }
      />
    </div>
  );
}
