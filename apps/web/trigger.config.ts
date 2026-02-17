import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "local-project",
  dirs: ["./trigger"],
  maxDuration: 300,
});
