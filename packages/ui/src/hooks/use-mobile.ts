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
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.innerWidth <= breakpoint;
  });

  React.useEffect(() => {
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

export const useIsMobile = useMobile;
