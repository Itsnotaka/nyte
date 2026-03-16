import { describe, it } from "vite-plus/test";

import { expectMarkup } from "./markup-test-utils";
import { LayerCard, LayerCardPrimary, LayerCardSecondary } from "../layer-card";

describe("LayerCard", () => {
  it("renders layered slots and merges custom props", () => {
    expectMarkup(
      <LayerCard className="root-class" id="layer-card-root">
        <LayerCardSecondary className="secondary-class">
          <span>Docs</span>
          <button type="button">Open</button>
        </LayerCardSecondary>
        <LayerCardPrimary className="primary-class" aria-label="Layer content">
          Body
        </LayerCardPrimary>
      </LayerCard>,
      {
        contains: [
          'data-slot="layer-card"',
          'data-slot="layer-card-secondary"',
          'data-slot="layer-card-primary"',
          "root-class",
          "secondary-class",
          "primary-class",
          "bg-sachi-fill",
          "justify-between",
          "bg-sachi-base",
          'id="layer-card-root"',
          'aria-label="Layer content"',
        ],
        excludes: [/\bp-1\.5\b/],
      },
    );
  });
});
