# Sidebar State Spec

This document defines every supported sidebar state and expected behavior for
layout, hover, rail visibility, and resizing.

## State Dimensions

- `viewport`: `desktop` (`>1024`) or `mobile` (`<=1024`)
- `variant`: `static`, `collapsed`, `mobile`
- `open`: whether floating/sheet panel is currently shown
- `resizing`: whether rail drag is active

Canonical formulas:

- Width:
  - desktop/static: `D = staticWidth` (clamped `220..330`)
  - desktop/collapsed-hover: panel width uses latest `staticWidth`
  - mobile/open: `mobileWidth` (clamped `220..330`, starts at `330`)
- Hidden offset:
  - `resizingMode === static`: `-D - 10`
  - mobile hidden: `-D`
  - collapsed hidden: `-D - 12`
- Collapsed floating geometry:
  - left: `8px`
  - top: `37.5px`
  - bottom: `8px`
  - margin/radius treatment: `6px / 5px`

## Behavior Matrix

### Desktop

- `desktop/static/open`:
  - Sidebar is docked.
  - Rail is visible and resizes `staticWidth`.
  - Spacer width equals layer width.

- `desktop/collapsed/closed`:
  - Sidebar layer is hidden with offset formula.
  - Edge hover target is visible.
  - Rail is not interactable until panel is shown.

- `desktop/collapsed/hover-open`:
  - Floating panel is visible.
  - Hover-safe proximity zone extends around panel to avoid accidental close on
    slight over-hover.
  - Rail is visible.
  - Dragging rail resizes collapsed-hover panel width only and must not switch
    to static during drag.
  - On release, state stays collapsed (hover closes when cursor leaves hit
    area).

- `desktop/collapsed/resizing`:
  - `isOpen` stays true during drag preview.
  - Width updates continuously.
  - Variant lock keeps drag mode collapsed even if computed threshold suggests
    static.
  - Known tolerated issue: when dragging to expand from floating mode, cursor
    position can cross over the sidebar body because of current width/offset
    calculation.

### Mobile

- `mobile/closed`:
  - Sheet panel hidden (off-canvas).
  - Rail hidden.
  - Overlay hidden.

- `mobile/open`:
  - Sheet panel visible.
  - Rail visible on the right edge.
  - Overlay visible and closes sheet on click.
  - Dragging rail updates `mobileWidth` continuously (clamped `220..330`).
  - Releasing rail keeps sidebar open.

- `mobile/resizing`:
  - Pointer capture must succeed on rail.
  - `startResize` uses current `mobileWidth` as drag baseline.
  - `moveResize` updates only `mobileWidth` and does not toggle to static.
  - `finishResize` commits `mobileWidth`, keeps `isOpen=true`.

## Interaction Rules

- Double-click rail:
  - Enabled on desktop only.
  - Ignored on mobile.

- Toggle button:
  - Desktop: static <-> collapsed.
  - Mobile: open <-> closed sheet.

- Viewport switch:
  - Crossing breakpoint (`1024`) swaps rendered `variant`.
  - Desktop state is remembered via `desktopVariant`.

## Debug Verification Targets

For runtime verification logs, these are the critical expected signals:

- Mobile open + rail drag:
  - `Rail pointer down received`
  - `Pointer capture succeeded`
  - `Resize started` with `variant: mobile`
  - Repeated `Mobile width updated during rail drag`
  - `Mobile resize committed without closing`

- Collapsed-hover drag:
  - `startVariant: collapsed`
  - transitions may compute static, but final drag variant must remain collapsed
    (`forcedCollapsedLock: true`)
  - commit branch must be `commitResize:collapsed`
