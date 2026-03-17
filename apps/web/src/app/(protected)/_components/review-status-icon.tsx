"use client";

import {
  IconCircle,
  IconCircleCheck,
  IconCircleDashed,
  IconCircleX,
} from "@central-icons-react/round-filled-radius-2-stroke-1.5";

import type { ReviewDecision } from "~/lib/github/server";

export function ReviewStatusIcon({
  reviewDecision,
}: {
  reviewDecision: ReviewDecision;
}) {
  switch (reviewDecision) {
    case "approved":
      return (
        <IconCircleCheck
          className="size-3.5 text-green-500"
          aria-label="Approved"
        />
      );
    case "changes_requested":
      return (
        <IconCircleX
          className="size-3.5 text-red-500"
          aria-label="Changes requested"
        />
      );
    case "review_required":
      return (
        <IconCircleDashed
          className="size-3.5 text-amber-400"
          aria-label="Review required"
        />
      );
    case "none":
      return (
        <IconCircle
          className="size-3.5 text-sachi-fg-faint"
          aria-label="No review"
        />
      );
  }
}
