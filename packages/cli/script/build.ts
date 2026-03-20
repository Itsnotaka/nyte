declare const Bun: {
  build(input: {
    entrypoints: string[];
    outdir: string;
    naming: {
      entry: string;
    };
    target: "node";
    format: "esm";
    sourcemap: "external";
  }): Promise<{
    success: boolean;
    logs: unknown[];
  }>;
};

const out = await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  naming: {
    entry: "[name].mjs",
  },
  target: "node",
  format: "esm",
  sourcemap: "external",
});

if (!out.success) {
  out.logs.forEach((log: unknown) => console.error(log));
  process.exitCode = 1;
}
