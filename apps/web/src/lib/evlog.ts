import type { Log } from "evlog";
import { createEvlog } from "evlog/next";

const evlog = createEvlog({
  service: "sachi-web",
});

export const withEvlog = evlog.withEvlog;
export const useLogger = evlog.useLogger;
export const log: Log = evlog.log;
export const createError = evlog.createError;
