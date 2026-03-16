import { renderToStaticMarkup } from "react-dom/server";
import { expect } from "vite-plus/test";

export function expectMarkup(
  element: React.ReactElement,
  options: {
    contains?: string[];
    excludes?: Array<string | RegExp>;
  },
) {
  const html = renderToStaticMarkup(element);

  for (const value of options.contains ?? []) {
    expect(html).toContain(value);
  }

  for (const value of options.excludes ?? []) {
    if (typeof value === "string") {
      expect(html).not.toContain(value);
      continue;
    }

    expect(html).not.toMatch(value);
  }

  return html;
}
