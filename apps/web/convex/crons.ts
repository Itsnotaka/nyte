import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// Placeholder server-side heartbeat while queue ingestion moves to Convex actions.
crons.interval(
  "queue-heartbeat",
  { minutes: 5 },
  internal.system.heartbeat,
  {}
);

export default crons;
