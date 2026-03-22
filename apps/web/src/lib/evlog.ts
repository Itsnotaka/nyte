import type { Log } from "evlog";
import { createEvlog } from "evlog/next";

const evlog = createEvlog({
  service: "sachi-web",
});

export const log: Log = evlog.log;
