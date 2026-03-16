import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LayerCard, LayerCardPrimary, LayerCardSecondary } from "../layer-card";

describe("LayerCard", () => {
  it("renders layered slots and merges custom props", () => {
    const html = renderToStaticMarkup(
      <LayerCard className="root-class" id="layer-card-root">
        <LayerCardSecondary className="secondary-class">
          <span>Docs</span>
          <button type="button">Open</button>
        </LayerCardSecondary>
        <LayerCardPrimary className="primary-class" aria-label="Layer content">
          Body
        </LayerCardPrimary>
      </LayerCard>
    );

    expect(html).toContain('data-slot="layer-card"');
    expect(html).toContain('data-slot="layer-card-secondary"');
    expect(html).toContain('data-slot="layer-card-primary"');
    expect(html).toContain("root-class");
    expect(html).toContain("secondary-class");
    expect(html).toContain("primary-class");
    expect(html).toContain("bg-card");
    expect(html).toContain("justify-between");
    expect(html).toContain("bg-background");
    expect(html).toContain('id="layer-card-root"');
    expect(html).toContain('aria-label="Layer content"');
  });
});
