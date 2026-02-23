import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "queue-ingestion",
  { minutes: 5 },
  internal.ingestion.enqueueCronIngestion,
  {}
);

export default crons;
