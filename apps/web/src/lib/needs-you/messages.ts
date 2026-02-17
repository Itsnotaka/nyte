export const NEEDS_YOU_MESSAGES = {
  actionAuthRequired: "Authentication required.",
  queueAuthRequired: "Connect Google to load Gmail and Calendar signals.",
  queueTokenUnavailable:
    "Google OAuth token is unavailable. Reconnect Google and grant Gmail + Calendar permissions.",
  syncUnavailable: "Unable to sync Gmail + Calendar right now.",
  approveUnavailable: "Unable to approve action.",
  dismissUnavailable: "Unable to dismiss action.",
  feedbackUnavailable: "Unable to record feedback.",
  invalidApprovePayload: "Invalid approval payload.",
  invalidDismissPayload: "Invalid dismissal payload.",
  invalidFeedbackPayload: "Invalid feedback payload.",
  invalidActionResponse: "Action response is invalid.",
  invalidSyncResponse: "Sync payload is invalid.",
  actionApprovedNotice: "Action approved.",
  actionDismissedNotice: "Action dismissed.",
  actionUpdateUnavailable: "Unable to update action status.",
  noActionCards: "No action cards right now.",
} as const;
