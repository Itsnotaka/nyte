"use client";

import { IconSidebarLeftArrow } from "@central-icons-react/round-filled-radius-2-stroke-1.5";
import * as React from "react";

import { cn } from "../../lib/utils";

const DEFAULT_STATIC_SIDEBAR_WIDTH = 244;
const MOBILE_SIDEBAR_WIDTH = 330;
const COLLAPSED_SPACER_WIDTH = 0;
const DEFAULT_SIDEBAR_MIN_WIDTH = 220;
const DEFAULT_SIDEBAR_MAX_WIDTH = 330;
const SIDEBAR_COLLAPSE_SNAP_X = 64;
const SIDEBAR_EXPAND_SNAP_X = 284;
const DRAG_MOVE_THRESHOLD = 2;
const SIDEBAR_MOBILE_BREAKPOINT = 1024;

type DesktopSidebarVariant = "static" | "collapsed";
type SidebarVariant = DesktopSidebarVariant | "mobile";
type SidebarState =
  | "open"
  | "collapsed"
  | "collapsed-hover"
  | "mobile"
  | "mobile-open";

type DragState = {
  pointerId: number;
  startX: number;
  startWidth: number;
  startVariant: DesktopSidebarVariant;
  dragVariant: DesktopSidebarVariant;
  hasMoved: boolean;
  rawWidth: number;
};

type SidebarStore = {
  variant: SidebarVariant;
  desktopVariant: DesktopSidebarVariant;
  staticWidth: number;
  mobileWidth: number;
  minWidth: number;
  maxWidth: number;
  isOpen: boolean;
  isSmallViewport: boolean;
  isResizing: boolean;
  resizingMode: DesktopSidebarVariant | null;
  drag: DragState | null;
  liveWidth: number;
  suppressDoubleClick: boolean;
  rafId: number | null;
  pendingLayout: {
    spacerWidth: number;
    layerWidth: number;
  } | null;
};

type SidebarSnapshot = {
  variant: SidebarVariant;
  state: SidebarState;
  isOpen: boolean;
  isSmallViewport: boolean;
  isResizing: boolean;
  width: number;
  staticWidth: number;
  spacerWidth: number;
  layerWidth: number;
  hiddenLeft: number;
  isCollapsedGeometry: boolean;
  isCollapsedVisible: boolean;
  isMobileGeometry: boolean;
  isMobileVisible: boolean;
};

type SidebarContextValue = {
  variant: SidebarVariant;
  state: SidebarState;
  isOpen: boolean;
  isResizing: boolean;
  width: number;
  staticWidth: number;
  toggle: () => void;
  toggleSidebar: () => void;
  expand: () => void;
  collapse: () => void;
};

type SidebarInternalContextValue = {
  snapshot: SidebarSnapshot;
  scheduleLayout: (spacerWidth: number, layerWidth: number) => void;
  startResize: (pointerId: number, clientX: number) => void;
  moveResize: (pointerId: number, clientX: number) => void;
  finishResize: (pointerId: number) => void;
  onRailDoubleClick: () => void;
  onSidebarMouseEnter: () => void;
  onSidebarMouseLeave: () => void;
  onCollapsedEdgeEnter: () => void;
  toggle: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);
const SidebarInternalContext =
  React.createContext<SidebarInternalContextValue | null>(null);

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

const shallowEqualSnapshot = (a: SidebarSnapshot, b: SidebarSnapshot) => {
  return (
    a.variant === b.variant &&
    a.state === b.state &&
    a.isOpen === b.isOpen &&
    a.isResizing === b.isResizing &&
    a.width === b.width &&
    a.staticWidth === b.staticWidth &&
    a.spacerWidth === b.spacerWidth &&
    a.layerWidth === b.layerWidth &&
    a.hiddenLeft === b.hiddenLeft &&
    a.isCollapsedGeometry === b.isCollapsedGeometry &&
    a.isCollapsedVisible === b.isCollapsedVisible &&
    a.isMobileGeometry === b.isMobileGeometry &&
    a.isMobileVisible === b.isMobileVisible &&
    a.isSmallViewport === b.isSmallViewport
  );
};

const resolveDragVariant = (
  rawWidth: number,
  dragVariant: DesktopSidebarVariant,
  startVariant: DesktopSidebarVariant
): DesktopSidebarVariant => {
  if (startVariant === "static") {
    if (dragVariant === "collapsed") {
      return "collapsed";
    }

    return rawWidth <= SIDEBAR_COLLAPSE_SNAP_X ? "collapsed" : "static";
  }

  if (dragVariant === "static") {
    return "static";
  }

  return rawWidth >= SIDEBAR_EXPAND_SNAP_X ? "static" : "collapsed";
};

const resolveLayerWidth = (store: SidebarStore) => {
  return store.isSmallViewport ? store.mobileWidth : store.staticWidth;
};

const getSnapshot = (store: SidebarStore): SidebarSnapshot => {
  const state: SidebarState =
    store.variant === "static"
      ? "open"
      : store.variant === "mobile"
        ? store.isOpen
          ? "mobile-open"
          : "mobile"
        : store.isOpen
          ? "collapsed-hover"
          : "collapsed";
  const layerWidth =
    store.variant === "static" ? store.staticWidth : resolveLayerWidth(store);
  const spacerWidth =
    store.variant === "static" ? store.staticWidth : COLLAPSED_SPACER_WIDTH;
  const hiddenLeft =
    store.resizingMode === "static"
      ? -layerWidth - 10
      : store.isSmallViewport
        ? -layerWidth
        : -layerWidth - 12;
  const isCollapsedGeometry = store.variant === "collapsed";
  const isMobileGeometry = store.variant === "mobile";
  const isCollapsedDragPreview =
    store.isResizing && store.drag?.startVariant === "collapsed";
  const isCollapsedVisible =
    isCollapsedGeometry && (store.isOpen || isCollapsedDragPreview);
  const isMobileVisible = isMobileGeometry && store.isOpen;

  return {
    variant: store.variant,
    state,
    isOpen: store.isOpen,
    isSmallViewport: store.isSmallViewport,
    isResizing: store.isResizing,
    width: layerWidth,
    staticWidth: store.staticWidth,
    spacerWidth,
    layerWidth,
    hiddenLeft,
    isCollapsedGeometry,
    isCollapsedVisible,
    isMobileGeometry,
    isMobileVisible,
  };
};

type SidebarProviderProps = React.ComponentProps<"div"> & {
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  defaultVariant?: DesktopSidebarVariant;
  trafficLightPosition?: boolean;
};

function SidebarProvider({
  defaultWidth = DEFAULT_STATIC_SIDEBAR_WIDTH,
  minWidth = DEFAULT_SIDEBAR_MIN_WIDTH,
  maxWidth = DEFAULT_SIDEBAR_MAX_WIDTH,
  defaultVariant = "static",
  trafficLightPosition = false,
  className,
  style,
  children,
  ...props
}: SidebarProviderProps) {
  const boundedMinWidth = Math.max(0, minWidth);
  const boundedMaxWidth = Math.max(boundedMinWidth, maxWidth);
  const initialStaticWidth = clamp(
    defaultWidth,
    boundedMinWidth,
    boundedMaxWidth
  );

  const storeRef = React.useRef<SidebarStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = {
      variant: defaultVariant,
      desktopVariant: defaultVariant,
      staticWidth: initialStaticWidth,
      mobileWidth: MOBILE_SIDEBAR_WIDTH,
      minWidth: boundedMinWidth,
      maxWidth: boundedMaxWidth,
      isOpen: false,
      isSmallViewport: false,
      isResizing: false,
      resizingMode: null,
      drag: null,
      liveWidth: initialStaticWidth,
      suppressDoubleClick: false,
      rafId: null,
      pendingLayout: null,
    };
  }

  const shellRef = React.useRef<HTMLDivElement | null>(null);
  const [snapshot, setSnapshot] = React.useState<SidebarSnapshot>(() => {
    return getSnapshot(storeRef.current as SidebarStore);
  });

  const emit = React.useCallback(() => {
    const store = storeRef.current;
    if (!store) {
      return;
    }

    const nextSnapshot = getSnapshot(store);
    setSnapshot((prevSnapshot) => {
      return shallowEqualSnapshot(prevSnapshot, nextSnapshot)
        ? prevSnapshot
        : nextSnapshot;
    });
  }, []);

  const applyLayout = React.useCallback(
    (spacerWidth: number, layerWidth: number) => {
      const shellElement = shellRef.current;
      if (!shellElement) {
        return;
      }

      shellElement.style.setProperty(
        "--sidebar-spacer-width",
        `${spacerWidth}px`
      );
      shellElement.style.setProperty(
        "--sidebar-layer-width",
        `${layerWidth}px`
      );
    },
    []
  );

  const scheduleLayout = React.useCallback(
    (spacerWidth: number, layerWidth: number) => {
      const store = storeRef.current;
      if (!store) {
        return;
      }

      store.pendingLayout = { spacerWidth, layerWidth };

      if (store.rafId !== null) {
        return;
      }

      store.rafId = window.requestAnimationFrame(() => {
        const currentStore = storeRef.current;
        if (!currentStore) {
          return;
        }

        currentStore.rafId = null;
        const pendingLayout = currentStore.pendingLayout;
        currentStore.pendingLayout = null;
        if (!pendingLayout) {
          return;
        }

        applyLayout(pendingLayout.spacerWidth, pendingLayout.layerWidth);
      });
    },
    [applyLayout]
  );

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(
      `(max-width: ${SIDEBAR_MOBILE_BREAKPOINT}px)`
    );

    const syncViewportVariant = () => {
      const store = storeRef.current;
      if (!store) {
        return;
      }

      const isSmallViewport = mediaQuery.matches;
      const nextVariant: SidebarVariant = isSmallViewport
        ? "mobile"
        : store.desktopVariant;
      const viewportChanged =
        store.isSmallViewport !== isSmallViewport ||
        store.variant !== nextVariant;
      if (viewportChanged || store.isResizing) {
        // #region agent log
        fetch(
          "http://127.0.0.1:7425/ingest/05007669-5789-447d-b19b-0dfcda27c9e8",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Debug-Session-Id": "5e2b51",
            },
            body: JSON.stringify({
              sessionId: "5e2b51",
              runId: "pre-fix-rail",
              hypothesisId: "H5",
              location:
                "packages/ui/src/components/ui/sidebar.tsx:syncViewportVariant",
              message: "Viewport sync evaluated",
              data: {
                viewportChanged,
                isSmallViewport,
                nextVariant,
                currentVariant: store.variant,
                desktopVariant: store.desktopVariant,
                isResizing: store.isResizing,
                isOpen: store.isOpen,
              },
              timestamp: Date.now(),
            }),
          }
        ).catch(() => {});
        // #endregion
      }
      if (!viewportChanged) {
        return;
      }

      store.isSmallViewport = isSmallViewport;
      store.variant = nextVariant;
      store.isOpen = false;

      const nextLayerWidth =
        nextVariant === "static" ? store.staticWidth : resolveLayerWidth(store);
      const nextSpacerWidth =
        nextVariant === "static" ? store.staticWidth : COLLAPSED_SPACER_WIDTH;
      scheduleLayout(nextSpacerWidth, nextLayerWidth);
      emit();
    };

    syncViewportVariant();
    mediaQuery.addEventListener("change", syncViewportVariant);
    return () => {
      mediaQuery.removeEventListener("change", syncViewportVariant);
    };
  }, [emit, scheduleLayout]);

  const commitResize = React.useCallback(
    (finalWidth: number, finalVariant: DesktopSidebarVariant) => {
      const store = storeRef.current;
      if (!store) {
        return;
      }
      // #region agent log
      fetch(
        "http://127.0.0.1:7425/ingest/05007669-5789-447d-b19b-0dfcda27c9e8",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "5e2b51",
          },
          body: JSON.stringify({
            sessionId: "5e2b51",
            runId: "pre-fix-rail",
            hypothesisId: "H3",
            location:
              "packages/ui/src/components/ui/sidebar.tsx:commitResize:entry",
            message: "Commit resize entry",
            data: {
              finalWidth,
              finalVariant,
              variantBefore: store.variant,
              desktopVariantBefore: store.desktopVariant,
              isOpenBefore: store.isOpen,
              isSmallViewport: store.isSmallViewport,
              staticWidthBefore: store.staticWidth,
            },
            timestamp: Date.now(),
          }),
        }
      ).catch(() => {});
      // #endregion

      store.isResizing = false;
      store.resizingMode = null;
      store.isOpen = false;

      if (finalVariant === "collapsed") {
        store.desktopVariant = "collapsed";
        store.variant = store.isSmallViewport ? "mobile" : "collapsed";
        const collapsedWidth = resolveLayerWidth(store);
        store.liveWidth = collapsedWidth;
        scheduleLayout(COLLAPSED_SPACER_WIDTH, collapsedWidth);
        // #region agent log
        fetch(
          "http://127.0.0.1:7425/ingest/05007669-5789-447d-b19b-0dfcda27c9e8",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Debug-Session-Id": "5e2b51",
            },
            body: JSON.stringify({
              sessionId: "5e2b51",
              runId: "pre-fix-rail",
              hypothesisId: "H3",
              location:
                "packages/ui/src/components/ui/sidebar.tsx:commitResize:collapsed",
              message: "Commit resize collapsed branch",
              data: {
                variantAfter: store.variant,
                desktopVariantAfter: store.desktopVariant,
                isOpenAfter: store.isOpen,
                collapsedWidth,
                staticWidthAfter: store.staticWidth,
              },
              timestamp: Date.now(),
            }),
          }
        ).catch(() => {});
        // #endregion
        emit();
        return;
      }

      const clampedWidth = clamp(finalWidth, store.minWidth, store.maxWidth);
      store.liveWidth = clampedWidth;
      store.staticWidth = clampedWidth;
      store.desktopVariant = "static";
      store.variant = store.isSmallViewport ? "mobile" : "static";
      if (store.variant === "static") {
        scheduleLayout(clampedWidth, clampedWidth);
      } else {
        scheduleLayout(COLLAPSED_SPACER_WIDTH, resolveLayerWidth(store));
      }
      // #region agent log
      fetch(
        "http://127.0.0.1:7425/ingest/05007669-5789-447d-b19b-0dfcda27c9e8",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "5e2b51",
          },
          body: JSON.stringify({
            sessionId: "5e2b51",
            runId: "pre-fix-rail",
            hypothesisId: "H4",
            location:
              "packages/ui/src/components/ui/sidebar.tsx:commitResize:static",
            message: "Commit resize static branch",
            data: {
              clampedWidth,
              variantAfter: store.variant,
              desktopVariantAfter: store.desktopVariant,
              isOpenAfter: store.isOpen,
              isSmallViewport: store.isSmallViewport,
              staticWidthAfter: store.staticWidth,
            },
            timestamp: Date.now(),
          }),
        }
      ).catch(() => {});
      // #endregion
      emit();
    },
    [emit, scheduleLayout]
  );

  const expand = React.useCallback(() => {
    const store = storeRef.current;
    if (!store) {
      return;
    }

    if (store.variant === "mobile") {
      if (store.isOpen) {
        return;
      }

      store.isOpen = true;
      scheduleLayout(COLLAPSED_SPACER_WIDTH, resolveLayerWidth(store));
      emit();
      return;
    }

    if (store.variant === "static") {
      return;
    }

    store.desktopVariant = "static";
    const restoredWidth = store.staticWidth;
    store.variant = "static";
    store.isOpen = false;
    store.liveWidth = restoredWidth;
    scheduleLayout(restoredWidth, restoredWidth);
    emit();
  }, [emit, scheduleLayout]);

  const collapse = React.useCallback(() => {
    const store = storeRef.current;
    if (!store) {
      return;
    }

    if (store.variant === "mobile") {
      if (!store.isOpen) {
        return;
      }

      store.isOpen = false;
      scheduleLayout(COLLAPSED_SPACER_WIDTH, resolveLayerWidth(store));
      emit();
      return;
    }

    if (store.variant === "collapsed") {
      return;
    }

    store.desktopVariant = "collapsed";
    store.variant = "collapsed";
    store.isOpen = false;
    const collapsedWidth = resolveLayerWidth(store);
    store.liveWidth = collapsedWidth;
    scheduleLayout(COLLAPSED_SPACER_WIDTH, collapsedWidth);
    emit();
  }, [emit, scheduleLayout]);

  const toggle = React.useCallback(() => {
    const store = storeRef.current;
    if (!store) {
      return;
    }

    if (store.variant === "mobile") {
      const previousIsOpen = store.isOpen;
      store.isOpen = !store.isOpen;
      // #region agent log
      fetch(
        "http://127.0.0.1:7425/ingest/05007669-5789-447d-b19b-0dfcda27c9e8",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "5e2b51",
          },
          body: JSON.stringify({
            sessionId: "5e2b51",
            runId: "pre-fix-rail",
            hypothesisId: "H8",
            location: "packages/ui/src/components/ui/sidebar.tsx:toggle:mobile",
            message: "Mobile toggle invoked",
            data: {
              previousIsOpen,
              nextIsOpen: store.isOpen,
              variant: store.variant,
              desktopVariant: store.desktopVariant,
              isSmallViewport: store.isSmallViewport,
            },
            timestamp: Date.now(),
          }),
        }
      ).catch(() => {});
      // #endregion
      scheduleLayout(COLLAPSED_SPACER_WIDTH, resolveLayerWidth(store));
      emit();
      return;
    }

    if (store.variant === "collapsed") {
      expand();
      return;
    }

    collapse();
  }, [collapse, emit, expand, scheduleLayout]);

  const onSidebarMouseEnter = React.useCallback(() => {
    const store = storeRef.current;
    if (
      !store ||
      store.variant !== "collapsed" ||
      store.isResizing ||
      store.isOpen
    ) {
      return;
    }

    store.isOpen = true;
    scheduleLayout(COLLAPSED_SPACER_WIDTH, resolveLayerWidth(store));
    emit();
  }, [emit, scheduleLayout]);

  const onSidebarMouseLeave = React.useCallback(() => {
    const store = storeRef.current;
    if (
      !store ||
      store.variant !== "collapsed" ||
      store.isResizing ||
      !store.isOpen
    ) {
      return;
    }

    store.isOpen = false;
    scheduleLayout(COLLAPSED_SPACER_WIDTH, resolveLayerWidth(store));
    emit();
  }, [emit, scheduleLayout]);

  const onCollapsedEdgeEnter = React.useCallback(() => {
    const store = storeRef.current;
    if (
      !store ||
      store.variant !== "collapsed" ||
      store.isResizing ||
      store.isOpen
    ) {
      return;
    }

    store.isOpen = true;
    scheduleLayout(COLLAPSED_SPACER_WIDTH, resolveLayerWidth(store));
    emit();
  }, [emit, scheduleLayout]);

  const startResize = React.useCallback(
    (pointerId: number, clientX: number) => {
      const store = storeRef.current;
      if (!store) {
        return;
      }
      if (store.variant === "mobile" && !store.isOpen) {
        // #region agent log
        fetch(
          "http://127.0.0.1:7425/ingest/05007669-5789-447d-b19b-0dfcda27c9e8",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Debug-Session-Id": "5e2b51",
            },
            body: JSON.stringify({
              sessionId: "5e2b51",
              runId: "pre-fix-rail",
              hypothesisId: "H7",
              location:
                "packages/ui/src/components/ui/sidebar.tsx:startResize:guard",
              message: "Resize blocked in closed mobile variant",
              data: {
                pointerId,
                clientX,
                variant: store.variant,
                desktopVariant: store.desktopVariant,
                isOpen: store.isOpen,
                isSmallViewport: store.isSmallViewport,
              },
              timestamp: Date.now(),
            }),
          }
        ).catch(() => {});
        // #endregion
        return;
      }

      const startVariant = store.desktopVariant;
      const startWidth = resolveLayerWidth(store);

      store.drag = {
        pointerId,
        startX: clientX,
        startWidth,
        startVariant,
        dragVariant: startVariant,
        hasMoved: false,
        rawWidth: startWidth,
      };
      store.liveWidth = startWidth;
      store.isResizing = true;
      store.resizingMode = startVariant;
      if (store.variant === "mobile" && !store.isOpen) {
        store.isOpen = true;
      }
      // #region agent log
      fetch(
        "http://127.0.0.1:7425/ingest/05007669-5789-447d-b19b-0dfcda27c9e8",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "5e2b51",
          },
          body: JSON.stringify({
            sessionId: "5e2b51",
            runId: "pre-fix-rail",
            hypothesisId: "H1",
            location: "packages/ui/src/components/ui/sidebar.tsx:startResize",
            message: "Resize started",
            data: {
              pointerId,
              clientX,
              variant: store.variant,
              desktopVariant: store.desktopVariant,
              startVariant,
              startWidth,
              staticWidth: store.staticWidth,
              resolvedLayerWidth: resolveLayerWidth(store),
              isOpen: store.isOpen,
              isSmallViewport: store.isSmallViewport,
            },
            timestamp: Date.now(),
          }),
        }
      ).catch(() => {});
      // #endregion

      if (store.variant === "mobile" || startVariant === "collapsed") {
        store.isOpen = true;
        scheduleLayout(COLLAPSED_SPACER_WIDTH, startWidth);
      } else {
        scheduleLayout(startWidth, startWidth);
      }

      emit();
    },
    [emit, scheduleLayout]
  );

  const moveResize = React.useCallback(
    (pointerId: number, clientX: number) => {
      const store = storeRef.current;
      if (!store || !store.drag || store.drag.pointerId !== pointerId) {
        return;
      }

      const dragState = store.drag;
      const deltaX = clientX - dragState.startX;
      if (!dragState.hasMoved && Math.abs(deltaX) >= DRAG_MOVE_THRESHOLD) {
        dragState.hasMoved = true;
      }

      const rawWidth = dragState.startWidth + deltaX;
      dragState.rawWidth = rawWidth;

      const nextWidth = clamp(rawWidth, store.minWidth, store.maxWidth);
      store.liveWidth = nextWidth;

      let shouldEmit = false;
      if (store.variant === "mobile") {
        const previousMobileWidth = store.mobileWidth;
        store.mobileWidth = nextWidth;
        store.desktopVariant = "collapsed";
        store.resizingMode = "collapsed";
        if (!store.isOpen) {
          store.isOpen = true;
          shouldEmit = true;
        }
        if (previousMobileWidth !== nextWidth) {
          // #region agent log
          fetch(
            "http://127.0.0.1:7425/ingest/05007669-5789-447d-b19b-0dfcda27c9e8",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Debug-Session-Id": "5e2b51",
              },
              body: JSON.stringify({
                sessionId: "5e2b51",
                runId: "post-fix-rail",
                hypothesisId: "H9",
                location:
                  "packages/ui/src/components/ui/sidebar.tsx:moveResize",
                message: "Mobile width updated during rail drag",
                data: {
                  pointerId,
                  deltaX,
                  rawWidth,
                  nextWidth,
                  previousMobileWidth,
                  isOpen: store.isOpen,
                  variant: store.variant,
                  desktopVariant: store.desktopVariant,
                },
                timestamp: Date.now(),
              }),
            }
          ).catch(() => {});
          // #endregion
        }
        scheduleLayout(COLLAPSED_SPACER_WIDTH, nextWidth);
        if (shouldEmit) {
          emit();
        }
        return;
      }

      const previousDragVariant = dragState.dragVariant;
      const computedNextVariant = resolveDragVariant(
        rawWidth,
        dragState.dragVariant,
        dragState.startVariant
      );
      const nextVariant =
        dragState.startVariant === "collapsed"
          ? "collapsed"
          : computedNextVariant;
      if (
        computedNextVariant !== previousDragVariant ||
        nextVariant !== previousDragVariant
      ) {
        // #region agent log
        fetch(
          "http://127.0.0.1:7425/ingest/05007669-5789-447d-b19b-0dfcda27c9e8",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Debug-Session-Id": "5e2b51",
            },
            body: JSON.stringify({
              sessionId: "5e2b51",
              runId: "pre-fix-rail",
              hypothesisId: "H2",
              location: "packages/ui/src/components/ui/sidebar.tsx:moveResize",
              message: "Drag variant transition",
              data: {
                pointerId,
                deltaX,
                rawWidth,
                nextWidth,
                startVariant: dragState.startVariant,
                previousDragVariant,
                computedNextVariant,
                nextVariant,
                forcedCollapsedLock: dragState.startVariant === "collapsed",
                renderedVariantBefore: store.variant,
                desktopVariantBefore: store.desktopVariant,
                isOpenBefore: store.isOpen,
                isSmallViewport: store.isSmallViewport,
              },
              timestamp: Date.now(),
            }),
          }
        ).catch(() => {});
        // #endregion
      }

      if (nextVariant !== dragState.dragVariant) {
        dragState.dragVariant = nextVariant;
        store.desktopVariant = nextVariant;
        store.resizingMode = nextVariant;
        const nextRenderedVariant = store.isSmallViewport
          ? "mobile"
          : nextVariant;
        if (store.variant !== nextRenderedVariant) {
          store.variant = nextRenderedVariant;
          shouldEmit = true;
        }
      }

      if (dragState.startVariant === "collapsed") {
        store.staticWidth = nextWidth;
      } else if (nextVariant === "static") {
        store.staticWidth = nextWidth;
      }

      if (nextVariant === "collapsed") {
        const nextIsOpen = dragState.startVariant === "collapsed";
        if (store.isOpen !== nextIsOpen) {
          store.isOpen = nextIsOpen;
          shouldEmit = true;
        }
        scheduleLayout(COLLAPSED_SPACER_WIDTH, resolveLayerWidth(store));
      } else {
        if (store.isOpen) {
          store.isOpen = false;
          shouldEmit = true;
        }
        scheduleLayout(nextWidth, nextWidth);
      }

      if (shouldEmit) {
        emit();
      }
    },
    [emit, scheduleLayout]
  );

  const finishResize = React.useCallback(
    (pointerId: number) => {
      const store = storeRef.current;
      if (!store || !store.drag || store.drag.pointerId !== pointerId) {
        return;
      }

      const dragState = store.drag;
      store.drag = null;
      // #region agent log
      fetch(
        "http://127.0.0.1:7425/ingest/05007669-5789-447d-b19b-0dfcda27c9e8",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "5e2b51",
          },
          body: JSON.stringify({
            sessionId: "5e2b51",
            runId: "pre-fix-rail",
            hypothesisId: "H3",
            location: "packages/ui/src/components/ui/sidebar.tsx:finishResize",
            message: "Resize finished",
            data: {
              pointerId,
              hasMoved: dragState.hasMoved,
              startVariant: dragState.startVariant,
              dragVariant: dragState.dragVariant,
              rawWidth: dragState.rawWidth,
              liveWidth: store.liveWidth,
              variantBeforeCommit: store.variant,
              desktopVariantBeforeCommit: store.desktopVariant,
              isOpenBeforeCommit: store.isOpen,
              isSmallViewport: store.isSmallViewport,
            },
            timestamp: Date.now(),
          }),
        }
      ).catch(() => {});
      // #endregion

      if (store.variant === "mobile") {
        store.isResizing = false;
        store.resizingMode = null;
        store.desktopVariant = "collapsed";
        store.mobileWidth = clamp(
          store.liveWidth,
          store.minWidth,
          store.maxWidth
        );
        store.isOpen = true;
        scheduleLayout(COLLAPSED_SPACER_WIDTH, store.mobileWidth);
        // #region agent log
        fetch(
          "http://127.0.0.1:7425/ingest/05007669-5789-447d-b19b-0dfcda27c9e8",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Debug-Session-Id": "5e2b51",
            },
            body: JSON.stringify({
              sessionId: "5e2b51",
              runId: "post-fix-rail",
              hypothesisId: "H10",
              location:
                "packages/ui/src/components/ui/sidebar.tsx:finishResize",
              message: "Mobile resize committed without closing",
              data: {
                pointerId,
                hasMoved: dragState.hasMoved,
                mobileWidth: store.mobileWidth,
                liveWidth: store.liveWidth,
                variant: store.variant,
                desktopVariant: store.desktopVariant,
                isOpen: store.isOpen,
              },
              timestamp: Date.now(),
            }),
          }
        ).catch(() => {});
        // #endregion
        emit();
        return;
      }

      if (!dragState.hasMoved) {
        store.isResizing = false;
        store.resizingMode = null;
        store.isOpen = false;
        store.desktopVariant = "collapsed";
        store.variant = store.isSmallViewport ? "mobile" : "collapsed";
        const collapsedWidth = resolveLayerWidth(store);
        store.liveWidth = collapsedWidth;
        scheduleLayout(COLLAPSED_SPACER_WIDTH, collapsedWidth);
        emit();
        return;
      }

      store.suppressDoubleClick = true;
      window.requestAnimationFrame(() => {
        const currentStore = storeRef.current;
        if (!currentStore) {
          return;
        }

        currentStore.suppressDoubleClick = false;
      });

      commitResize(store.liveWidth, dragState.dragVariant);
    },
    [commitResize, emit, scheduleLayout]
  );

  const onRailDoubleClick = React.useCallback(() => {
    const store = storeRef.current;
    if (
      !store ||
      store.variant === "mobile" ||
      store.isResizing ||
      store.suppressDoubleClick
    ) {
      return;
    }

    if (store.variant === "collapsed") {
      expand();
      return;
    }

    collapse();
  }, [collapse, expand]);

  const sidebarContextValue = React.useMemo<SidebarContextValue>(() => {
    return {
      variant: snapshot.variant,
      state: snapshot.state,
      isOpen: snapshot.isOpen,
      isResizing: snapshot.isResizing,
      width: snapshot.width,
      staticWidth: snapshot.staticWidth,
      toggle,
      toggleSidebar: toggle,
      expand,
      collapse,
    };
  }, [collapse, expand, snapshot, toggle]);

  const sidebarInternalContextValue =
    React.useMemo<SidebarInternalContextValue>(() => {
      return {
        snapshot,
        scheduleLayout,
        startResize,
        moveResize,
        finishResize,
        onRailDoubleClick,
        onSidebarMouseEnter,
        onSidebarMouseLeave,
        onCollapsedEdgeEnter,
        toggle,
      };
    }, [
      finishResize,
      moveResize,
      onCollapsedEdgeEnter,
      onRailDoubleClick,
      onSidebarMouseEnter,
      onSidebarMouseLeave,
      scheduleLayout,
      snapshot,
      startResize,
      toggle,
    ]);

  const shellStyle = {
    "--sidebar-spacer-width": `${snapshot.spacerWidth}px`,
    "--sidebar-layer-width": `${snapshot.layerWidth}px`,
    "--sidebar-mobile-max-width": `min(calc(100vw - 40px), ${MOBILE_SIDEBAR_WIDTH}px)`,
    "--sidebar-float-left": "8px",
    "--sidebar-float-top": "37.5px",
    "--sidebar-float-bottom": "8px",
    "--sidebar-collapsed-margin": "6px",
    "--sidebar-collapsed-radius": "5px",
    "--sidebar-collapsed-edge-left": trafficLightPosition ? "-5px" : "0px",
    "--sidebar-rail-offset": "-5px",
    "--sidebar-rail-top": "14px",
    "--sidebar-rail-bottom": "14px",
    "--sidebar-rail-width": "10px",
    "--sidebar-transition-fast": "0.1s",
    "--sidebar-transition-normal": "0.25s",
    "--sidebar-ease": "cubic-bezier(0.215, 0.61, 0.355, 1)",
    "--sidebar-rail-indicator-color": "var(--color-rail)",
    "--sidebar-rail-indicator-active-color": "var(--color-icon-active)",
    "--sidebar-focus-color": "var(--color-focus)",
    "--sidebar-hover-overlay-bg": "rgba(0, 0, 0, 0.6)",
    "--sidebar-hover-overlay-opacity": "1",
    ...style,
  } as React.CSSProperties;

  return (
    <SidebarContext.Provider value={sidebarContextValue}>
      <SidebarInternalContext.Provider value={sidebarInternalContextValue}>
        <div
          ref={shellRef}
          data-sidebar-shell
          className={cn("min-h-dvh w-full", className)}
          style={shellStyle}
          {...props}
        >
          <div
            data-sidebar-track
            data-sidebar-state={snapshot.state}
            data-sidebar-collapsed={
              snapshot.variant === "static" ? "false" : "true"
            }
            data-resizing={snapshot.isResizing ? "true" : undefined}
            className="relative flex size-full"
          >
            {children}
          </div>
        </div>
      </SidebarInternalContext.Provider>
    </SidebarContext.Provider>
  );
}

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return context;
}

function useSidebarInternal() {
  const context = React.useContext(SidebarInternalContext);
  if (!context) {
    throw new Error(
      "Sidebar components must be used within a SidebarProvider."
    );
  }

  return context;
}

function Sidebar({
  className,
  children,
  ...props
}: React.ComponentProps<"aside">) {
  const {
    snapshot,
    onSidebarMouseEnter,
    onSidebarMouseLeave,
    onCollapsedEdgeEnter,
    toggle,
  } = useSidebarInternal();

  const spacerStyle = {
    width: "var(--sidebar-spacer-width)",
    flexBasis: "var(--sidebar-spacer-width)",
    transition: "width var(--sidebar-transition-fast) var(--sidebar-ease)",
  } as React.CSSProperties;

  const isFloatingVisible =
    snapshot.isCollapsedVisible || snapshot.isMobileVisible;
  const layerStyle = {
    width: "var(--sidebar-layer-width)",
    maxWidth: snapshot.isMobileGeometry
      ? "var(--sidebar-mobile-max-width)"
      : undefined,
    left:
      snapshot.variant === "static"
        ? 0
        : snapshot.isCollapsedGeometry
          ? snapshot.isCollapsedVisible
            ? "var(--sidebar-float-left)"
            : snapshot.hiddenLeft
          : snapshot.isMobileVisible
            ? 0
            : snapshot.hiddenLeft,
    top: snapshot.isCollapsedGeometry ? "var(--sidebar-float-top)" : 0,
    bottom: snapshot.isCollapsedGeometry ? "var(--sidebar-float-bottom)" : 0,
    borderColor:
      (snapshot.isCollapsedGeometry || snapshot.isMobileGeometry) &&
      isFloatingVisible
        ? "var(--sidebar-collapsed-border-color, var(--color-border-strong))"
        : "transparent",
    boxShadow:
      (snapshot.isCollapsedGeometry || snapshot.isMobileGeometry) &&
      isFloatingVisible
        ? "var(--sidebar-collapsed-shadow, none)"
        : "none",
    borderRadius: snapshot.isCollapsedGeometry
      ? "var(--sidebar-collapsed-radius)"
      : "0px",
    transition:
      "width var(--sidebar-transition-fast) var(--sidebar-ease), left var(--sidebar-transition-normal) var(--sidebar-ease), top var(--sidebar-transition-normal) var(--sidebar-ease), bottom var(--sidebar-transition-normal) var(--sidebar-ease), border-color var(--sidebar-transition-normal) var(--sidebar-ease), box-shadow var(--sidebar-transition-normal) var(--sidebar-ease), border-radius var(--sidebar-transition-normal) var(--sidebar-ease)",
  } as React.CSSProperties;

  const collapsedEdgeStyle = {
    top: "calc(var(--sidebar-float-top) + var(--sidebar-rail-top) - 20px)",
    bottom:
      "calc(var(--sidebar-float-bottom) + var(--sidebar-rail-bottom) - 5px)",
    left: "var(--sidebar-collapsed-edge-left)",
    width: "20px",
  } as React.CSSProperties;

  const showOverlay =
    snapshot.state === "collapsed-hover" || snapshot.state === "mobile-open";
  const hoverOverlayStyle = {
    opacity: showOverlay ? "var(--sidebar-hover-overlay-opacity, 1)" : "0",
    backgroundColor: "var(--sidebar-hover-overlay-bg, rgba(0, 0, 0, 0.6))",
    transition: "opacity var(--sidebar-transition-normal) var(--sidebar-ease)",
  } as React.CSSProperties;

  return (
    <>
      <div
        data-sidebar-spacer
        aria-hidden
        className="h-full shrink-0"
        style={spacerStyle}
      />
      {snapshot.state === "mobile-open" ? (
        <button
          type="button"
          data-sidebar-hover-overlay
          aria-label="Close sidebar"
          className="absolute inset-0 z-[19] border-0 bg-transparent p-0"
          style={hoverOverlayStyle}
          onClick={() => {
            // #region agent log
            fetch(
              "http://127.0.0.1:7425/ingest/05007669-5789-447d-b19b-0dfcda27c9e8",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-Debug-Session-Id": "5e2b51",
                },
                body: JSON.stringify({
                  sessionId: "5e2b51",
                  runId: "post-fix-rail",
                  hypothesisId: "H13",
                  location:
                    "packages/ui/src/components/ui/sidebar.tsx:mobileOverlay:onClick",
                  message: "Mobile overlay clicked",
                  data: {
                    state: snapshot.state,
                    variant: snapshot.variant,
                    isOpen: snapshot.isOpen,
                    isSmallViewport: snapshot.isSmallViewport,
                  },
                  timestamp: Date.now(),
                }),
              }
            ).catch(() => {});
            // #endregion
            toggle();
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          data-sidebar-hover-overlay
          className="pointer-events-none absolute inset-0 z-[19]"
          style={hoverOverlayStyle}
        />
      )}
      <div
        data-sidebar-layer
        data-sidebar-variant={snapshot.variant}
        data-sidebar-width={snapshot.layerWidth}
        data-sidebar-open={snapshot.isOpen ? "true" : "false"}
        data-collapsed-geometry={
          snapshot.isCollapsedGeometry ? "true" : "false"
        }
        data-collapsed-visible={snapshot.isCollapsedVisible ? "true" : "false"}
        className="absolute inset-y-0 left-0 z-20 overflow-hidden border border-transparent"
        style={layerStyle}
        onMouseEnter={onSidebarMouseEnter}
        onMouseLeave={onSidebarMouseLeave}
      >
        <aside
          data-sidebar
          className={cn("flex h-full min-w-0 flex-col", className)}
          {...props}
        >
          {children}
        </aside>
      </div>

      {snapshot.variant === "collapsed" ? (
        <button
          type="button"
          data-sidebar-edge
          aria-label="Preview sidebar"
          onMouseEnter={onCollapsedEdgeEnter}
          onFocus={onCollapsedEdgeEnter}
          onClick={toggle}
          className="group absolute z-[18] cursor-col-resize border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--sidebar-focus-color)]"
          style={collapsedEdgeStyle}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[5px] left-1/2 top-5 w-px -translate-x-1/2 rounded-full bg-[var(--sidebar-rail-indicator-color)] opacity-0 transition-[opacity,width,background-color] duration-[var(--sidebar-transition-fast)] ease-[var(--sidebar-ease)] group-hover:w-0.5 group-hover:bg-[var(--sidebar-rail-indicator-active-color)] group-hover:opacity-100 group-focus-visible:w-0.5 group-focus-visible:bg-[var(--sidebar-rail-indicator-active-color)] group-focus-visible:opacity-100"
          />
        </button>
      ) : null}
    </>
  );
}

function SidebarRail({
  className,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  onDoubleClick,
  ...props
}: React.ComponentProps<"button">) {
  const { snapshot, startResize, moveResize, finishResize, onRailDoubleClick } =
    useSidebarInternal();
  const hasLoggedMobileRailHiddenRef = React.useRef(false);

  if (snapshot.variant !== "mobile") {
    hasLoggedMobileRailHiddenRef.current = false;
  }

  if (snapshot.variant === "mobile" && !snapshot.isOpen) {
    return null;
  }
  if (snapshot.variant === "mobile" && !hasLoggedMobileRailHiddenRef.current) {
    hasLoggedMobileRailHiddenRef.current = true;
    // #region agent log
    fetch("http://127.0.0.1:7425/ingest/05007669-5789-447d-b19b-0dfcda27c9e8", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "5e2b51",
      },
      body: JSON.stringify({
        sessionId: "5e2b51",
        runId: "post-fix-rail",
        hypothesisId: "H6",
        location: "packages/ui/src/components/ui/sidebar.tsx:SidebarRail",
        message: "Rail rendered while mobile sidebar open",
        data: {
          state: snapshot.state,
          variant: snapshot.variant,
          isOpen: snapshot.isOpen,
          isSmallViewport: snapshot.isSmallViewport,
          width: snapshot.width,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }

  const railStyle = {
    right: "var(--sidebar-rail-offset)",
    top: "var(--sidebar-rail-top)",
    bottom: "var(--sidebar-rail-bottom)",
  } as React.CSSProperties;

  return (
    <button
      type="button"
      data-sidebar-rail
      data-resizing={snapshot.isResizing ? "true" : undefined}
      className={cn(
        "group absolute z-[25] w-(--sidebar-rail-width) cursor-col-resize border-0 bg-transparent p-0 touch-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--sidebar-focus-color)]",
        className
      )}
      style={railStyle}
      onPointerDown={(event) => {
        // #region agent log
        fetch(
          "http://127.0.0.1:7425/ingest/05007669-5789-447d-b19b-0dfcda27c9e8",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Debug-Session-Id": "5e2b51",
            },
            body: JSON.stringify({
              sessionId: "5e2b51",
              runId: "post-fix-rail",
              hypothesisId: "H11",
              location:
                "packages/ui/src/components/ui/sidebar.tsx:SidebarRail:onPointerDown",
              message: "Rail pointer down received",
              data: {
                pointerId: event.pointerId,
                pointerType: event.pointerType,
                clientX: event.clientX,
                state: snapshot.state,
                variant: snapshot.variant,
                isOpen: snapshot.isOpen,
                isSmallViewport: snapshot.isSmallViewport,
              },
              timestamp: Date.now(),
            }),
          }
        ).catch(() => {});
        // #endregion
        onPointerDown?.(event);
        if (event.defaultPrevented) {
          // #region agent log
          fetch(
            "http://127.0.0.1:7425/ingest/05007669-5789-447d-b19b-0dfcda27c9e8",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Debug-Session-Id": "5e2b51",
              },
              body: JSON.stringify({
                sessionId: "5e2b51",
                runId: "post-fix-rail",
                hypothesisId: "H11",
                location:
                  "packages/ui/src/components/ui/sidebar.tsx:SidebarRail:onPointerDown",
                message: "Rail pointer down prevented",
                data: {
                  pointerId: event.pointerId,
                  pointerType: event.pointerType,
                  state: snapshot.state,
                  variant: snapshot.variant,
                },
                timestamp: Date.now(),
              }),
            }
          ).catch(() => {});
          // #endregion
          return;
        }

        event.preventDefault();
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
          // #region agent log
          fetch(
            "http://127.0.0.1:7425/ingest/05007669-5789-447d-b19b-0dfcda27c9e8",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Debug-Session-Id": "5e2b51",
              },
              body: JSON.stringify({
                sessionId: "5e2b51",
                runId: "post-fix-rail",
                hypothesisId: "H12",
                location:
                  "packages/ui/src/components/ui/sidebar.tsx:SidebarRail:onPointerDown",
                message: "Pointer capture succeeded",
                data: {
                  pointerId: event.pointerId,
                  pointerType: event.pointerType,
                  hasCapture: event.currentTarget.hasPointerCapture(
                    event.pointerId
                  ),
                  state: snapshot.state,
                  variant: snapshot.variant,
                },
                timestamp: Date.now(),
              }),
            }
          ).catch(() => {});
          // #endregion
        } catch (error) {
          // #region agent log
          fetch(
            "http://127.0.0.1:7425/ingest/05007669-5789-447d-b19b-0dfcda27c9e8",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Debug-Session-Id": "5e2b51",
              },
              body: JSON.stringify({
                sessionId: "5e2b51",
                runId: "post-fix-rail",
                hypothesisId: "H12",
                location:
                  "packages/ui/src/components/ui/sidebar.tsx:SidebarRail:onPointerDown",
                message: "Pointer capture failed",
                data: {
                  pointerId: event.pointerId,
                  pointerType: event.pointerType,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Unknown pointer capture error",
                  state: snapshot.state,
                  variant: snapshot.variant,
                },
                timestamp: Date.now(),
              }),
            }
          ).catch(() => {});
          // #endregion
          return;
        }
        startResize(event.pointerId, event.clientX);
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        if (event.defaultPrevented) {
          return;
        }

        moveResize(event.pointerId, event.clientX);
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event);
        if (event.defaultPrevented) {
          return;
        }

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        finishResize(event.pointerId);
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event);
        if (event.defaultPrevented) {
          return;
        }

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        finishResize(event.pointerId);
      }}
      onLostPointerCapture={(event) => {
        onLostPointerCapture?.(event);
        if (event.defaultPrevented) {
          return;
        }

        finishResize(event.pointerId);
      }}
      onDoubleClick={(event) => {
        onDoubleClick?.(event);
        if (event.defaultPrevented) {
          return;
        }

        onRailDoubleClick();
      }}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 rounded-full bg-[var(--sidebar-rail-indicator-color)] opacity-0 transition-[opacity,width,background-color] duration-[var(--sidebar-transition-fast)] ease-[var(--sidebar-ease)] group-hover:w-0.5 group-hover:bg-[var(--sidebar-rail-indicator-active-color)] group-hover:opacity-100 group-focus-visible:w-0.5 group-focus-visible:bg-[var(--sidebar-rail-indicator-active-color)] group-focus-visible:opacity-100",
          snapshot.isResizing &&
            "w-0.5 bg-[var(--sidebar-rail-indicator-active-color)] opacity-100"
        )}
      />
    </button>
  );
}

function SidebarInset({
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"main">) {
  const { snapshot } = useSidebarInternal();

  const insetStyle = {
    paddingTop: "var(--shell-gutter, 8px)",
    paddingRight: "var(--shell-gutter, 8px)",
    paddingBottom: "var(--shell-gutter, 8px)",
    paddingLeft: snapshot.variant === "static" ? 0 : "var(--shell-gutter, 8px)",
    transition:
      "padding-left var(--sidebar-transition-normal) var(--sidebar-ease)",
    ...style,
  } as React.CSSProperties;

  const insetInnerStyle = {
    borderRadius: "var(--shell-inset-radius, 8px)",
  } as React.CSSProperties;

  return (
    <main
      data-sidebar-inset
      className={cn("min-h-0 min-w-0 flex-1", className)}
      style={insetStyle}
      {...props}
    >
      <div
        data-sidebar-inset-inner
        className="relative flex h-full min-h-0 flex-col overflow-hidden border border-[var(--color-border-strong)] bg-[var(--color-inset-bg)] [&>*]:min-h-0"
        style={insetInnerStyle}
      >
        {children}
      </div>
    </main>
  );
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-sidebar-header
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-sidebar-footer
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-sidebar-content
      className={cn("min-h-0 flex-1 overflow-auto", className)}
      {...props}
    />
  );
}

type SidebarTriggerProps = React.ComponentProps<"button"> & {
  hideWhenExpanded?: boolean;
};

function SidebarTrigger({
  className,
  onClick,
  hideWhenExpanded = true,
  children,
  type,
  ...props
}: SidebarTriggerProps) {
  const { variant, toggle } = useSidebar();

  if (hideWhenExpanded && variant === "static") {
    return null;
  }

  return (
    <button
      type={type ?? "button"}
      data-sidebar-trigger
      className={cn(
        "absolute left-3 top-2 z-[2] inline-flex size-6.5 items-center justify-center rounded-[5px] border-0 bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-control-bg-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--sidebar-focus-color)]",
        className
      )}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) {
          return;
        }

        toggle();
      }}
      {...props}
    >
      {children ?? (
        <IconSidebarLeftArrow className="size-4" aria-hidden="true" />
      )}
      <span className="sr-only">Toggle Sidebar</span>
    </button>
  );
}

const SidebarRails = SidebarRail;

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarRails,
  SidebarTrigger,
  useSidebar,
};
