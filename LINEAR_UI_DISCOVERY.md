# Linear UI Discovery Runbook

This document explains exactly how to inspect Linear's shipped desktop/web UI assets so teammates can continue the work.

## Goal

Find concrete UI implementation details (layout sizes, spacing, colors, component structure) from Linear's installed app and cached web bundles.

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
- Renderer code is not fully embedded there; it loads web assets (Linear web client).

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
3. Inspect minified bundles with `rg` focused on terms: `sidebar`, `split`, `layout`, `issue`, `panel`, `width`, `border`, `color`.
4. Copy only concrete values/patterns into app code; avoid guessing.

## Notes

- Asset hashes change often; names in this doc are examples from one snapshot.
- Prefer discovering fresh filenames from local `ScriptCache` first.
- `/tmp` extraction directories are disposable; re-run steps to refresh.
