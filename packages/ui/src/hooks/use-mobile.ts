import * as React from "react";

const DEFAULT_MOBILE_BREAKPOINT = 768;

const resolveBreakpoint = (breakpointOrResolver?: number | (() => number)) => {
  const resolvedBreakpoint =
    typeof breakpointOrResolver === "function" ? breakpointOrResolver() : breakpointOrResolver;

  if (!Number.isFinite(resolvedBreakpoint)) {
    return DEFAULT_MOBILE_BREAKPOINT;
  }

  const normalizedBreakpoint = Number(resolvedBreakpoint);
  return Math.max(0, Math.floor(normalizedBreakpoint));
};

export function useMobile(breakpointOrResolver?: number | (() => number)) {
  const breakpoint = resolveBreakpoint(breakpointOrResolver);
  // Must match SSR and the first client paint — never read `window` in the
  // initializer or server HTML and client hydration will disagree (see React
  // hydration docs). Sync the real viewport after mount; useLayoutEffect runs
  // before paint so mobile users rarely flash the desktop layout.
  const [isMobile, setIsMobile] = React.useState(false);

  React.useLayoutEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`);

    const syncIsMobile = () => {
      setIsMobile(mediaQuery.matches);
    };

    syncIsMobile();
    mediaQuery.addEventListener("change", syncIsMobile);

    return () => {
      mediaQuery.removeEventListener("change", syncIsMobile);
    };
  }, [breakpoint]);

  return isMobile;
}
