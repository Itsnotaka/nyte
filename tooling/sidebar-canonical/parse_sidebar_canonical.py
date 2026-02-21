#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


def must_match(pattern: str, text: str, label: str) -> re.Match[str]:
    match = re.search(pattern, text)
    if not match:
        raise ValueError(f"Could not parse {label}")
    return match


def parse_sidebar_summary(raw_log: str) -> dict[str, object]:
    assets = sorted(set(re.findall(r"assets/[A-Za-z0-9_.-]+\.js", raw_log)))
    manifest_source = must_match(
        r"manifest_source:\s*(.+)", raw_log, "manifest source"
    ).group(1)
    asset_host = must_match(r"asset_host:\s*(.+)", raw_log, "asset host").group(1)

    laptop_breakpoint = int(
        must_match(r"laptop:(\d+)", raw_log, "laptop breakpoint").group(1)
    )
    breakpoint_query = must_match(
        r"\(max-width: \$\{p\.laptop\}px\)",
        raw_log,
        "laptop media query",
    ).group(0)

    min_width = int(must_match(r"X=(\d+),Z=", raw_log, "minimum width").group(1))
    collapsed_margin = int(
        must_match(r"X=\d+,Z=(\d+)", raw_log, "collapsed margin").group(1)
    )
    max_width = int(
        must_match(r"D=p\?(\d+):ce", raw_log, "mobile width cap").group(1)
    )
    hidden_formula = must_match(
        r"me=x===`static`\?-D-10:p\?-D:-D-Z\*2",
        raw_log,
        "hidden offset formula",
    ).group(0)

    variant_formula = must_match(
        r"P=w\?`static`:p\?`mobile`:`collapsed`",
        raw_log,
        "variant formula",
    ).group(0)
    _ = variant_formula

    edge_top = int(
        must_match(
            r"top:(-?\d+)px;left:",
            raw_log,
            "collapsed edge top",
        ).group(1)
    )
    edge_right = int(
        must_match(
            r"right:(-?\d+)px;bottom:",
            raw_log,
            "collapsed edge right",
        ).group(1)
    )
    edge_bottom = int(
        must_match(
            r"bottom:(-?\d+)px;",
            raw_log,
            "collapsed edge bottom",
        ).group(1)
    )
    edge_left_traffic, edge_left_default = must_match(
        r"trafficLightPosition\?(-?\d+):(-?\d+)",
        raw_log,
        "collapsed edge left offsets",
    ).groups()

    default_sidebar_width = int(
        must_match(
            r"Z\((\d+),Q\.browserSession,\{onUpdate:e=>\{e\.updateSidebarWidthForSplashScreen\(\)\}\}\)\],\$\.prototype,`sidebarWidth`",
            raw_log,
            "default sidebar width",
        ).group(1)
    )
    default_sidebar_collapsed_token = must_match(
        r"Z\((!0|!1),Q\.browserSession,\{onUpdate:e=>\{e\.updateSidebarWidthForSplashScreen\(\)\}\}\)\],\$\.prototype,`sidebarCollapsed`",
        raw_log,
        "default sidebar collapsed",
    ).group(1)
    default_sidebar_collapsed = default_sidebar_collapsed_token == "!0"

    return {
        "source": {
            "manifest_source": manifest_source,
            "asset_host": asset_host,
            "assets": assets,
        },
        "breakpoint": {
            "name": "laptop",
            "value": laptop_breakpoint,
            "query": breakpoint_query,
            "consumer": "isSmall = M(A)",
        },
        "variants": {
            "canonical": ["static", "collapsed", "mobile"],
            "formula": "P=w?`static`:p?`mobile`:`collapsed`",
        },
        "width": {
            "min": min_width,
            "max": max_width,
            "collapsed_margin": collapsed_margin,
            "desktop_formula": "D = sidebarWidth",
            "mobile_formula": f"D = {max_width}",
        },
        "hidden_offset": {
            "formula": hidden_formula,
            "resolved": {
                "resizingMode_static": "-D - 10",
                "mobile": "-D",
                "desktop_collapsed": "-D - 12",
            },
        },
        "geometry": {
            "collapsed_desktop": {
                "margin": collapsed_margin,
                "border_radius": 5,
            },
            "mobile_sheet": {
                "full_height": True,
                "margin": 0,
                "border_radius": 0,
                "max_width": f"min(calc(100vw - 40px), {max_width}px)",
            },
            "collapsed_edge_hit_area": {
                "top": edge_top,
                "right": edge_right,
                "bottom": edge_bottom,
                "left_traffic_light": int(edge_left_traffic),
                "left_default": int(edge_left_default),
            },
        },
        "defaults": {
            "sidebarWidth": default_sidebar_width,
            "sidebarCollapsed": default_sidebar_collapsed,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("tooling/sidebar-canonical/linear-sidebar-canonical.raw.log"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("tooling/sidebar-canonical/linear-sidebar-canonical.summary.json"),
    )
    args = parser.parse_args()

    raw_log = args.input.read_text(encoding="utf-8")
    summary = parse_sidebar_summary(raw_log)
    args.output.write_text(
        json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
