import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: {
      index: "src/index.ts",
      "components/*": "src/components/ui/*.tsx",
      "hooks/*": "src/hooks/*.ts",
      "lib/*": "src/lib/*.ts",
    },
    dts: false,
    external: [
      "@central-icons-react/round-filled-radius-2-stroke-1.5",
      "next-themes",
      "react",
      "react-dom",
      "react/jsx-runtime",
    ],
    outputOptions: {
      banner: '"use client";',
    },
  },
});
