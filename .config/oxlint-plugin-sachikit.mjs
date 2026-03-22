// Oxlint JS plugins are alpha; this rule forbids inline `import("m").Type` (use top-level `import type`).

const noInlineTypeImport = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow inline type imports with a named qualifier (`import(\"spec\").Name`). Prefer top-level `import type`.",
    },
    messages: {
      noInlineTypeImport:
        'Use a top-level `import type { … } from "…"` instead of an inline `import("…").…` type.',
    },
    schema: [],
  },
  create(context) {
    return {
      TSImportType(node) {
        if (!node.qualifier) return;
        context.report({ messageId: "noInlineTypeImport", node });
      },
    };
  },
};

const plugin = {
  meta: {
    name: "sachikit",
  },
  rules: {
    "no-inline-type-import": noInlineTypeImport,
  },
};

export default plugin;
