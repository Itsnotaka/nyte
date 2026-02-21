"use client";

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  IconChevronDownMedium,
  IconSidebarLeftArrow,
} from "@central-icons-react/round-filled-radius-2-stroke-1.5";

import styles from "./layout.module.scss";

type AppShellClientProps = {
  children: React.ReactNode;
  interfaceTheme: "light" | "dark";
};

type SidebarVariant = "static" | "collapsed";

type DragState = {
  pointerId: number;
  startX: number;
  startWidth: number;
  startVariant: SidebarVariant;
  dragVariant: SidebarVariant;
  hasMoved: boolean;
  rawWidth: number;
};

const DEFAULT_STATIC_SIDEBAR_WIDTH = 220;
const DEFAULT_COLLAPSED_LAYER_WIDTH = 220;
const COLLAPSED_SPACER_WIDTH = 0;
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 330;
const SIDEBAR_COLLAPSE_SNAP_X = 64;
const SIDEBAR_EXPAND_SNAP_X = 284;
const SIDEBAR_FLOAT_LEFT = 8;
const SIDEBAR_FLOAT_TOP = 37.5;
const SIDEBAR_FLOAT_BOTTOM = 8;
const SIDEBAR_COLLAPSED_HIDDEN_GAP = 12;
const DRAG_MOVE_THRESHOLD = 2;

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

export const AppShellClient = ({ children, interfaceTheme }: AppShellClientProps) => {
  const [variant, setVariant] = useState<SidebarVariant>("static");
  const [isOpen, setIsOpen] = useState(false);
  const [staticWidth, setStaticWidth] = useState(DEFAULT_STATIC_SIDEBAR_WIDTH);
  const [collapsedWidth] = useState(DEFAULT_COLLAPSED_LAYER_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  const shellRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const liveWidthRef = useRef(DEFAULT_STATIC_SIDEBAR_WIDTH);
  const staticWidthRef = useRef(DEFAULT_STATIC_SIDEBAR_WIDTH);
  const collapsedWidthRef = useRef(DEFAULT_COLLAPSED_LAYER_WIDTH);
  const variantRef = useRef<SidebarVariant>("static");
  const suppressDoubleClickRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const pendingLayoutRef = useRef<{
    spacerWidth: number;
    layerWidth: number;
  } | null>(null);

  useEffect(() => {
    staticWidthRef.current = staticWidth;
  }, [staticWidth]);

  useEffect(() => {
    collapsedWidthRef.current = collapsedWidth;
  }, [collapsedWidth]);

  useEffect(() => {
    variantRef.current = variant;
  }, [variant]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const setVariantState = (nextVariant: SidebarVariant) => {
    if (variantRef.current === nextVariant) {
      return;
    }

    variantRef.current = nextVariant;
    setVariant(nextVariant);
  };

  const resolveDragVariant = (
    rawWidth: number,
    dragVariant: SidebarVariant,
    startVariant: SidebarVariant,
  ): SidebarVariant => {
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

  const applyLayout = (spacerWidth: number, layerWidth: number) => {
    const shellElement = shellRef.current;

    if (!shellElement) {
      return;
    }

    shellElement.style.setProperty("--sidebar-spacer-width", `${spacerWidth}px`);
    shellElement.style.setProperty("--sidebar-layer-width", `${layerWidth}px`);
  };

  const scheduleLayout = (spacerWidth: number, layerWidth: number) => {
    pendingLayoutRef.current = { spacerWidth, layerWidth };

    if (animationFrameRef.current !== null) {
      return;
    }

    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null;

      const pendingLayout = pendingLayoutRef.current;

      if (!pendingLayout) {
        return;
      }

      applyLayout(pendingLayout.spacerWidth, pendingLayout.layerWidth);
    });
  };

  const commitResize = (finalWidth: number, finalVariant: SidebarVariant) => {
    setIsResizing(false);
    setIsOpen(false);

    if (finalVariant === "collapsed") {
      setVariantState("collapsed");
      liveWidthRef.current = collapsedWidthRef.current;
      scheduleLayout(COLLAPSED_SPACER_WIDTH, collapsedWidthRef.current);
      return;
    }

    const clampedWidth = clamp(finalWidth, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH);
    liveWidthRef.current = clampedWidth;
    staticWidthRef.current = clampedWidth;
    setStaticWidth(clampedWidth);
    setVariantState("static");
    scheduleLayout(clampedWidth, clampedWidth);
  };

  const finishDrag = (pointerId: number, railHandle?: HTMLButtonElement) => {
    const dragState = dragRef.current;

    if (!dragState || dragState.pointerId !== pointerId) {
      return;
    }

    if (railHandle?.hasPointerCapture(pointerId)) {
      railHandle.releasePointerCapture(pointerId);
    }

    dragRef.current = null;

    if (!dragState.hasMoved) {
      setIsResizing(false);
      setIsOpen(false);
      setVariantState("collapsed");
      liveWidthRef.current = collapsedWidthRef.current;
      scheduleLayout(COLLAPSED_SPACER_WIDTH, collapsedWidthRef.current);
      return;
    }

    suppressDoubleClickRef.current = true;
    window.requestAnimationFrame(() => {
      suppressDoubleClickRef.current = false;
    });

    const finalWidth = liveWidthRef.current;
    const finalVariant = dragState.dragVariant;
    commitResize(finalWidth, finalVariant);
  };

  const onRailPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const startVariant = variantRef.current;
    const startWidth =
      startVariant === "collapsed" ? collapsedWidthRef.current : staticWidthRef.current;

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth,
      startVariant,
      dragVariant: startVariant,
      hasMoved: false,
      rawWidth: startWidth,
    };

    liveWidthRef.current = startWidth;
    setIsResizing(true);

    if (startVariant === "collapsed") {
      setIsOpen(true);
      scheduleLayout(COLLAPSED_SPACER_WIDTH, startWidth);
      return;
    }

    scheduleLayout(startWidth, startWidth);
  };

  const onRailPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = dragRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;

    if (!dragState.hasMoved && Math.abs(deltaX) >= DRAG_MOVE_THRESHOLD) {
      dragState.hasMoved = true;
    }

    const rawWidth = dragState.startWidth + deltaX;
    dragState.rawWidth = rawWidth;

    const nextWidth = clamp(rawWidth, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH);
    liveWidthRef.current = nextWidth;

    const currentDragVariant = dragState.dragVariant;
    const nextVariant = resolveDragVariant(rawWidth, currentDragVariant, dragState.startVariant);

    if (nextVariant !== currentDragVariant) {
      dragState.dragVariant = nextVariant;
      setVariantState(nextVariant);

      if (nextVariant === "static") {
        staticWidthRef.current = nextWidth;
        setStaticWidth(nextWidth);
      }
    }

    if (nextVariant === "collapsed") {
      setIsOpen(dragState.startVariant === "collapsed");
      scheduleLayout(COLLAPSED_SPACER_WIDTH, nextWidth);
      return;
    }

    setIsOpen(false);
    scheduleLayout(nextWidth, nextWidth);
  };

  const onRailPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    finishDrag(event.pointerId, event.currentTarget);
  };

  const onRailPointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    finishDrag(event.pointerId, event.currentTarget);
  };

  const onRailLostPointerCapture = (event: ReactPointerEvent<HTMLButtonElement>) => {
    finishDrag(event.pointerId);
  };

  const onRailDoubleClick = () => {
    if (isResizing || suppressDoubleClickRef.current) {
      return;
    }

    if (variantRef.current === "collapsed") {
      const restoredWidth = staticWidthRef.current;
      setVariantState("static");
      setIsOpen(false);
      scheduleLayout(restoredWidth, restoredWidth);
      return;
    }

    setVariantState("collapsed");
    setIsOpen(false);
    scheduleLayout(COLLAPSED_SPACER_WIDTH, collapsedWidthRef.current);
  };

  const onSidebarMouseEnter = () => {
    if (variantRef.current === "collapsed" && !isResizing) {
      setIsOpen(true);
      scheduleLayout(COLLAPSED_SPACER_WIDTH, collapsedWidthRef.current);
    }
  };

  const onSidebarMouseLeave = () => {
    if (variantRef.current === "collapsed" && !isResizing) {
      setIsOpen(false);
      scheduleLayout(COLLAPSED_SPACER_WIDTH, collapsedWidthRef.current);
    }
  };

  const onCollapsedEdgeEnter = () => {
    if (variantRef.current === "collapsed" && !isResizing) {
      setIsOpen(true);
      scheduleLayout(COLLAPSED_SPACER_WIDTH, collapsedWidthRef.current);
    }
  };

  const onSidebarToggle = () => {
    if (variantRef.current === "collapsed") {
      const restoredWidth = staticWidthRef.current;
      setVariantState("static");
      setIsOpen(false);
      scheduleLayout(restoredWidth, restoredWidth);
      return;
    }

    setVariantState("collapsed");
    setIsOpen(false);
    scheduleLayout(COLLAPSED_SPACER_WIDTH, collapsedWidthRef.current);
  };

  const sidebarState = variant === "static" ? "open" : isOpen ? "collapsed-hover" : "collapsed";
  const sidebarSpacerWidth = variant === "collapsed" ? COLLAPSED_SPACER_WIDTH : staticWidth;
  const sidebarLayerWidth = variant === "collapsed" ? collapsedWidth : staticWidth;
  const isCollapsedGeometry = variant === "collapsed";
  const isCollapsedDragPreview = isResizing && dragRef.current?.startVariant === "collapsed";
  const isCollapsedVisible = isCollapsedGeometry && (isOpen || isCollapsedDragPreview);

  const shellStyle = {
    "--sidebar-spacer-width": `${sidebarSpacerWidth}px`,
    "--sidebar-layer-width": `${sidebarLayerWidth}px`,
    "--sidebar-float-top": `${SIDEBAR_FLOAT_TOP}px`,
    "--sidebar-float-bottom": `${SIDEBAR_FLOAT_BOTTOM}px`,
  } as CSSProperties;

  const sidebarSpacerStyle = {
    width: "var(--sidebar-spacer-width)",
  } as CSSProperties;

  const sidebarLayerStyle = {
    width: "var(--sidebar-layer-width)",
    left: isCollapsedGeometry
      ? isCollapsedVisible
        ? SIDEBAR_FLOAT_LEFT
        : `calc((var(--sidebar-layer-width) + ${SIDEBAR_COLLAPSED_HIDDEN_GAP}px) * -1)`
      : 0,
    top: isCollapsedGeometry ? SIDEBAR_FLOAT_TOP : 0,
    bottom: isCollapsedGeometry ? SIDEBAR_FLOAT_BOTTOM : 0,
  } as CSSProperties;

  return (
    <div ref={shellRef} className={styles.appShell} data-theme={interfaceTheme} style={shellStyle}>
      <div
        className={styles.shellTrack}
        data-resizing={isResizing ? "true" : undefined}
        data-sidebar-state={sidebarState}
        data-sidebar-collapsed={variant === "collapsed" ? "true" : "false"}
      >
        <div className={styles.sidebarSpacer} style={sidebarSpacerStyle} aria-hidden />

        <div
          className={styles.sidebarLayer}
          style={sidebarLayerStyle}
          onMouseEnter={onSidebarMouseEnter}
          onMouseLeave={onSidebarMouseLeave}
          data-sidebar-variant={variant}
          data-sidebar-width={sidebarLayerWidth}
          data-sidebar-open={isOpen ? "true" : "false"}
          data-collapsed-geometry={isCollapsedGeometry ? "true" : "false"}
          data-collapsed-visible={isCollapsedVisible ? "true" : "false"}
        >
          <aside className={styles.sidebar}>
            <header className={styles.sidebarHeader}>
              <div className={styles.sidebarTopRow}>
                <button
                  type="button"
                  className={styles.workspaceButton}
                  aria-label="Toggle sidebar dropdown"
                >
                  <IconChevronDownMedium
                    className={styles.dropdownIndicatorIcon}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </header>

            <nav className={styles.sidebarScrollArea} aria-label="Sidebar" />
          </aside>

          <div className={styles.sidebarRail} data-resizing={isResizing}>
            <button
              type="button"
              className={styles.sidebarRailHandle}
              aria-label="Resize sidebar"
              onPointerDown={onRailPointerDown}
              onPointerMove={onRailPointerMove}
              onPointerUp={onRailPointerUp}
              onPointerCancel={onRailPointerCancel}
              onLostPointerCapture={onRailLostPointerCapture}
              onDoubleClick={onRailDoubleClick}
            />
          </div>
        </div>

        {variant === "collapsed" ? (
          <button
            type="button"
            className={styles.collapsedHoverEdge}
            aria-label="Preview sidebar"
            onMouseEnter={onCollapsedEdgeEnter}
            onFocus={onCollapsedEdgeEnter}
            onClick={onSidebarToggle}
          />
        ) : null}

        <main className={styles.mainArea}>
          <div className={styles.mainInset}>
            {variant === "collapsed" ? (
              <button
                type="button"
                className={styles.mainSidebarToggle}
                aria-label="Toggle sidebar"
                onClick={onSidebarToggle}
              >
                <IconSidebarLeftArrow aria-hidden="true" />
              </button>
            ) : null}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
