export const REQUEST_EVENTS = {
  queueSync: {
    start: "queue.sync.start",
    unauthorized: "queue.sync.unauthorized",
    tokenMissing: "queue.sync.token-missing",
    success: "queue.sync.success",
    taskError: "queue.sync.task-error",
  },
  actionApprove: {
    start: "action.approve.start",
    unauthorized: "action.approve.unauthorized",
    invalidPayload: "action.approve.invalid-payload",
    success: "action.approve.success",
    domainError: "action.approve.domain-error",
    taskError: "action.approve.task-error",
  },
  actionDismiss: {
    start: "action.dismiss.start",
    unauthorized: "action.dismiss.unauthorized",
    invalidPayload: "action.dismiss.invalid-payload",
    success: "action.dismiss.success",
    domainError: "action.dismiss.domain-error",
    taskError: "action.dismiss.task-error",
  },
  actionFeedback: {
    start: "action.feedback.start",
    unauthorized: "action.feedback.unauthorized",
    invalidPayload: "action.feedback.invalid-payload",
    success: "action.feedback.success",
    domainError: "action.feedback.domain-error",
    taskError: "action.feedback.task-error",
  },
} as const;
