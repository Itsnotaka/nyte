export type RuntimeCommandType =
  | "runtime.ingest"
  | "runtime.approve"
  | "runtime.dismiss"
  | "runtime.feedback";

export type RuntimeCommand<TPayload = unknown> = {
  type: RuntimeCommandType;
  payload: TPayload;
};
