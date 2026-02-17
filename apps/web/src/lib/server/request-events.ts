export const REQUEST_EVENTS = {
  queueSync: {
    start: "queue.sync.start",
    unauthorized: "queue.sync.unauthorized",
    tokenMissing: "queue.sync.token-missing",
    success: "queue.sync.success",
  },
  actionApprove: {
    start: "action.approve.start",
    unauthorized: "action.approve.unauthorized",
    invalidPayload: "action.approve.invalid-payload",
    success: "action.approve.success",
    domainError: "action.approve.domain-error",
  },
  actionDismiss: {
    start: "action.dismiss.start",
    unauthorized: "action.dismiss.unauthorized",
    invalidPayload: "action.dismiss.invalid-payload",
    success: "action.dismiss.success",
    domainError: "action.dismiss.domain-error",
  },
  actionFeedback: {
    start: "action.feedback.start",
    unauthorized: "action.feedback.unauthorized",
    invalidPayload: "action.feedback.invalid-payload",
    success: "action.feedback.success",
    domainError: "action.feedback.domain-error",
  },
} as const;
