# Linear UI Discovery Runbook

This document explains exactly how to inspect Linear's shipped desktop/web UI
assets so teammates can continue the work.

## Goal

Find concrete UI implementation details (layout sizes, spacing, colors,
component structure) from Linear's installed app and cached web bundles.

## Paths Used

- App bundle: `/System/Volumes/Data/Applications/Linear.app`
- Local app data: `~/Library/Application Support/Linear`
- Working extract directory (temporary): `/tmp/linear-asar`
- Working asset directory (temporary): `/tmp/linear-assets`

## 1) Inspect the Electron Bundle

Check that the app and `app.asar` exist:

```bash
ls -la '/System/Volumes/Data/Applications/Linear.app/Contents/Resources'
```

Install `asar` (if missing) and extract:

```bash
npx --yes asar extract \
  '/System/Volumes/Data/Applications/Linear.app/Contents/Resources/app.asar' \
  /tmp/linear-asar
```

Key finding:

- `out/main/index.js` contains Electron main-process code.
- Renderer code is not fully embedded there; it loads web assets (Linear web
  client).

Useful check:

```bash
rg -n "entryUrl|host|loadURL" /tmp/linear-asar/out/main/index.js
```

## 2) Find Cached Web Asset Manifest from Service Worker

Linear caches client assets locally. Start here:

```bash
find "$HOME/Library/Application Support/Linear/Service Worker/ScriptCache" -type f
```

Dump strings from script cache file (example ID may differ):

```bash
strings -n 8 "$HOME/Library/Application Support/Linear/Service Worker/ScriptCache/6db4f59a1f671e6c_0"
```

This reveals a full asset list like:

- `assets/Root-*.css`
- `assets/LinearLayout.*.js`
- `assets/SidebarCollapsedNavigation.*.js`
- `assets/SplitView.*.js`
- `assets/SplitIssueView.*.js`

## 3) Pull Actual Assets from Static Host

Fetch from:

- `https://static.linear.app/client/assets/<asset-file>`

Example:

```bash
curl -sI 'https://static.linear.app/client/assets/Root-CmPl8xUF.css'
curl -sL 'https://static.linear.app/client/assets/Root-CmPl8xUF.css' | sed -n '1,260p'
```

Save key files locally for repeated analysis:

```bash
mkdir -p /tmp/linear-assets
for f in \
  Root-CmPl8xUF.css \
  LinearLayout.DZmv0pNI.js \
  SidebarCollapsedNavigation.jvHM3cti.js \
  SplitView.CS83Jm6v.js \
  SplitIssueView.CZwOBsnk.js \
  src.vBhHZGC_.js \
  useSidebarDesktop.D7dDavDf.js \
  useIssueView.7w_i-v3y.js; do
  curl -sL "https://static.linear.app/client/assets/$f" -o "/tmp/linear-assets/$f"
done
```

## 4) Extract Concrete UI Values

Search extracted files for layout tokens and dimensions:

```bash
rg -n "--sidebar-width|bg-sidebar|bg-base|bg-border|content-color|rounded|margin|SplitView|leftSlot|rightSlot" /tmp/linear-assets/*
```

Examples we used:

- `--sidebar-width: 244px`
- Base dark shell colors around `#090909` and `#101012`
- Border tone around `#23252a`
- Split view managed with persisted separator positions and min widths

## 5) Cross-check with Runtime HTML Shell

The shell HTML contains additional startup/base styles:

```bash
curl -sL 'https://linear.app/' | sed -n '1,260p'
```

This helps confirm:

- Initial CSS variables and color system
- Desktop/electron conditional classes
- Startup loading shell structure

## 6) Recommended Working Pattern

1. Get latest service worker manifest from local cache.
2. Pull target assets from `static.linear.app`.
3. Inspect minified bundles with `rg` focused on terms: `sidebar`, `split`,
   `layout`, `issue`, `panel`, `width`, `border`, `color`.
4. Copy only concrete values/patterns into app code; avoid guessing.

## 7) Layout Component Map (App Shell / Sidebar / Content / Theme)

### App shell / composition

- `assets/Layout.DAT1LeVK.js`
- `assets/LinearLayout.DZmv0pNI.js`
- `assets/LoadApplicationLayout.CTM-BiY8.js`
- `assets/MainAppLayout.CAMsFMpw.js`
- `assets/PortalLayoutRoot.CW6elkbc.js`

### Sidebar / navigation

- `assets/SidebarCollapsedNavigation.jvHM3cti.js`
- `assets/useSidebarDesktop.D7dDavDf.js`
- `assets/useSidebarItems.8UcS60Bx.js`
- `assets/OrganizationHeader.DSGWRy8C.js`
- `assets/useIsSplitViewHeaderTight.CCBjUwYu.js`

### Content shell / header / subheader

- `assets/ContentHeader.BkSByqqv.js`
- `assets/ContentViewContainer.OAK-o_9I.js`
- `assets/ContentViewHeader.CfVZVkwL.js`
- `assets/ContentViewHeaderBreadcrumb.CmtrXmgM.js`
- `assets/ContentViewHeaderTitle.CKVbYJxW.js`
- `assets/ContentViewHeaderFilterButton.CIrxC58P.js`
- `assets/ContentViewHeaderFavoriteActionButton.DpGStqbz.js`
- `assets/ContentViewHeaderInlineSearch.C6ffaa-Q.js`
- `assets/ContentViewHeaderContextualMenu.CmPAisgR.js`
- `assets/ContentViewSubheader.Da4OXwAF.js`
- `assets/SubheaderContainer.aoCrENKC.js`
- `assets/ResponsiveSlot.DQ4JfmaM.js`

### Split view / issues view

- `assets/SplitView.CS83Jm6v.js`
- `assets/SplitViewPanel.eJm7Zgwd.js`
- `assets/SplitIssueView.CZwOBsnk.js`
- `assets/useIsSplitView.w2R5R2zG.js`
- `assets/useIssueView.7w_i-v3y.js`

### Theme selector / light theme

- `assets/SettingActions.BIK2W0EV.js` (`Change interface theme…` action)
- `assets/ThemeSettingsHelper.DOB5dAdn.js` (theme update + view transition)
- `assets/lightThemeRefresh.CAzx1tQt.js` (light theme token generation)
- `assets/BaseThemeProvider.BVCce2Nm.js` (theme provider)
- `assets/useUserSettings.BhlPp4S5.js` (theme source from user settings)

### Top nav finding

- There is not a single global website-style top nav bar in the app shell.
- The app uses contextual content headers (`ContentHeader` /
  `ContentViewHeader`) and subheaders per view, plus sidebar/workspace controls.

## 8) Web Shell Geometry + Typography Findings (Canonical)

From live web CSS bundles (`/_next/static/css/*.css`) and runtime DOM
inspection:

### Sidebar shell geometry

- Sidebar uses a **244px spacer + 244px positioned sidebar layer** pattern.
- Sidebar top row is `height: 40px` with `margin-top: 8px`.
- Sidebar rail/edge handle geometry appears as:
  - `right: -5px`
  - `top: 14px`
  - `bottom: 14px`
- Sidebar links are dense, ~`28px` row height with compact horizontal insets.

### Inset content shell geometry

- Main content is inset from shell edges (compact gutter), with single border
  and rounded corners.
- Avoid double seam borders between sidebar and content inset; keep one
  canonical seam.

### Typography scale (web)

Observed in `https://linear.app/_next/static/css/da9566a426022001.css`:

- `--text-regular-size: 0.9375rem` (15px)
- `--text-small-size: 0.875rem` (14px)
- `--text-mini-size: 0.8125rem` (13px)
- `--text-micro-size: 0.75rem` (12px)
- `--font-size-regular: 0.9375rem` (15px)
- `--font-size-small: 0.8125rem` (13px)

Practical default body text in app views is usually around **14–15px tier**
depending on component (`small` vs `regular`).

## 9) Nyte Sidebar Hover/Collapse Replication Notes

### Problem statement

- Collapsed hover sidebar must match Linear’s floating panel geometry (inset
  from top/left, rounded corners, ambient shadow), not full-height flush.
- Dragging to collapse should require **overdrag past min width** and not
  instant flip; dragging back should **not thrash** state.
- Rail colors/geometry and drag hit-area must match Linear.
- Collapse/open animation speed currently feels too fast; must match source
  timing.

### Changes already applied in Nyte

- Drag state machine with one-way latch per drag session (no flip-flop):
  - `apps/web/src/app/(protected)/app-shell-client.tsx`
  - Uses canonical snap points:
    - collapse when drag rail reaches `x <= 64px` from the left edge
    - expand when drag rail reaches `x >= 284px`
  - Rail single-click collapses while open/static (restored behavior).
  - Drag activation threshold tightened to `2px` for more reliable intent
    detection.
- Collapsed hover geometry (floating panel):
  - width `220`, hidden offset `-(width + 12)`, visible left `8`, top `37.5`,
    bottom `8`.
  - Applied via inline `left/top/bottom` when `variant="collapsed"`.
  - `data-collapsed-geometry` + `data-collapsed-visible` attributes drive
    floating border/shadow.
  - `apps/web/src/app/(protected)/layout.module.scss`
- Hover edge hit area widened to `20` with top/bottom offsets tied to rail
  geometry and source collapsed-area offsets (`-20` / `-5`).

### Known source geometry values

From direct inspection (Linear devtools + screenshots):

- Floating panel style observed in source:
  - `width: 220px`
  - `left: -232px`
  - `top: 37.5px`
  - `bottom: 0px`
- Rail geometry:
  - `right: -5px`
  - `top: 14px`
  - `bottom: 14px`
- Collapsed toggle hit region (`SidebarCollapsedNavigation.*.js`) is
  intentionally larger than the icon:
  - `top: -20px`
  - `right: -5px`
  - `bottom: -5px`
  - `left: -40px` (or `-5px` when mac traffic-light offset is active)

Approximate screenshot bounds (Linear hovered-collapsed panel):

- x ≈ 29, y ≈ 72, right ≈ 399, bottom ≈ 1828 (image: 674×1862)
- This implies left inset ~29px and top inset ~72px in that capture.

### What’s left

- Align rail colors/hover states and collapsed drag hit-area precisely.
- Adjust collapse/open animation speed to match Linear (likely slower than
  `--speed-quickTransition` 0.1s).
- Confirm exact floating panel radius and shadow values (current: radius 10,
  ambient shadow).
- Validate snap-point drag feel (`64`/`284`) in live interaction after restoring
  rail single-click collapse.

### How to locate missing details

- **Devtools**: Inspect the hovered-collapsed panel element and record inline
  `style` + computed `top/left/bottom/width`.
- **Assets**:
  - Search `Root-*.css` for `--speed-*Transition` to confirm timing tokens.
  - Search `/tmp/linear-assets/useSidebarDesktop.*.js` and
    `SidebarCollapsedNavigation.*.js` for hover/drag logic.
- **Screenshots**:
  - Use a PNG parser to compute bounding boxes by brightness thresholds to
    verify inset geometry.
  - Example script (no PIL) can be used to extract approximate bounds.

### Current knowledge to reuse

- Linear tokens in `apps/web/src/styles/linear-native.scss` already match:
  - `--sidebar-rail-offset: -5px`
  - `--sidebar-rail-top: 14px`
  - `--sidebar-rail-width: 10px`
  - `--speed-quickTransition: 0.1s`, `--speed-regularTransition: 0.25s`
- Sidebar layout constants in
  `apps/web/src/app/(protected)/app-shell-client.tsx`:
  - static width 220, min/max drag 220/330, collapse threshold 236.

## Notes

- Asset hashes change often; names in this doc are examples from one snapshot.
- Prefer discovering fresh filenames from local `ScriptCache` first.
- `/tmp` extraction directories are disposable; re-run steps to refresh.
