export const WORKFLOW_TASK_IDS = {
  ingestSignals: "workflow.ingest-signals",
  approveAction: "workflow.approve-action",
  dismissAction: "workflow.dismiss-action",
  feedback: "workflow.feedback",
} as const;

export type WorkflowTaskId = (typeof WORKFLOW_TASK_IDS)[keyof typeof WORKFLOW_TASK_IDS];
