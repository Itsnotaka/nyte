"use client";

import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import styles from "./layout.module.scss";

type SidebarItem = {
  id: string;
  label: string;
  icon:
    | "inbox"
    | "issues"
    | "projects"
    | "views"
    | "more"
    | "import"
    | "invite"
    | "github";
  active?: boolean;
  nested?: boolean;
};

type SidebarSection = {
  id: string;
  label: string;
  items: SidebarItem[];
};

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

const primaryItems: SidebarItem[] = [
  { id: "inbox", label: "Inbox", icon: "inbox" },
  { id: "my-issues", label: "My issues", icon: "issues" },
];

const workspaceSections: SidebarSection[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { id: "projects", label: "Projects", icon: "projects" },
      { id: "views", label: "Views", icon: "views", active: true },
      { id: "more", label: "More", icon: "more" },
    ],
  },
  {
    id: "your-teams",
    label: "Your teams",
    items: [
      {
        id: "team-issues",
        label: "Issues",
        icon: "issues",
        nested: true,
        active: true,
      },
      {
        id: "team-projects",
        label: "Projects",
        icon: "projects",
        nested: true,
      },
      { id: "team-views", label: "Views", icon: "views", nested: true },
    ],
  },
  {
    id: "try",
    label: "Try",
    items: [
      { id: "import-issues", label: "Import issues", icon: "import" },
      { id: "invite-people", label: "Invite people", icon: "invite" },
      { id: "link-github", label: "Link GitHub", icon: "github" },
    ],
  },
];

const SidebarIcon = ({ icon }: { icon: SidebarItem["icon"] }) => {
  if (icon === "inbox") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M11.01 1.01c1.02.08 1.88.78 2.18 1.77l1.7 5.65c.11.38.13.77.06 1.16l-.45 2.53-.07.31A2.78 2.78 0 0 1 11.38 15H4.93A2.78 2.78 0 0 1 1.55 12.42l-.07-.31-.45-2.53a2.5 2.5 0 0 1 .03-1.02l.04-.14 1.7-5.65A2.75 2.75 0 0 1 5 1h6.01ZM2.51 9H4.37c.95 0 1.84.48 2.37 1.27l.04.05c.1.11.24.18.39.18h1.65c.17 0 .33-.09.43-.23l.1-.14A2.95 2.95 0 0 1 11.62 9h1.86l-.03-.14-1.7-5.65A1.26 1.26 0 0 0 10.8 2.5H5.19a1.25 1.25 0 0 0-1.17.71l-.06.15-1.7 5.64A1.09 1.09 0 0 0 2.5 9Zm.45 2.85c.17.95.99 1.65 1.97 1.65h6.13c.97 0 1.8-.7 1.97-1.65l.24-1.35h-1.65c-.4 0-.77.17-1.03.47l-.1.13A2.16 2.16 0 0 1 8.82 12H7.17a2.16 2.16 0 0 1-1.6-.79l-.08-.1A1.31 1.31 0 0 0 4.37 10.5H2.72l.24 1.35Z" />
      </svg>
    );
  }

  if (icon === "issues") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M14.25 10a.75.75 0 0 1 .75.75v1.5A2.75 2.75 0 0 1 12.25 15h-1.5a.75.75 0 1 1 0-1.5h1.5c.69 0 1.25-.56 1.25-1.25v-1.5a.75.75 0 0 1 .75-.75ZM1.75 10a.75.75 0 0 1 .75.75v1.5c0 .69.56 1.25 1.25 1.25h1.5a.75.75 0 1 1 0 1.5h-1.5A2.75 2.75 0 0 1 1 12.25v-1.5a.75.75 0 0 1 .75-.75ZM8 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm2.75-5a.75.75 0 1 1 0 1.5h1.5c.69 0 1.25.56 1.25 1.25v1.5a.75.75 0 1 1-1.5 0v-1.5c0-.69-.56-1.25-1.25-1.25h-1.5ZM5.25 1a.75.75 0 1 1 0 1.5h-1.5c-.69 0-1.25.56-1.25 1.25v1.5a.75.75 0 1 1-1.5 0v-1.5A2.75 2.75 0 0 1 3.75 1h1.5Z" />
      </svg>
    );
  }

  if (icon === "projects") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 3.25h4.5v4.5H3v-4.5Zm5.5 0H13v4.5H8.5v-4.5ZM3 8.25h4.5v4.5H3v-4.5Zm5.5 0H13v4.5H8.5v-4.5Z" />
      </svg>
    );
  }

  if (icon === "views") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6.93 2.21a2.99 2.99 0 0 1 2.29.07l5.07 2.47c.94.46.96 1.81.03 2.3L9.29 9.68a2.75 2.75 0 0 1-2.58 0L1.69 7.05c-.93-.49-.91-1.84.03-2.3l5.06-2.47.15-.07Zm.52 1.46a1.55 1.55 0 0 1 1.1.05l4.61 2.19-4.58 2.4a1.25 1.25 0 0 1-1.17 0l-4.57-2.4 4.61-2.2Zm6.45 6.41a.75.75 0 0 1 1.01.29.75.75 0 0 1-.32.91L9.5 13.67a2.75 2.75 0 0 1-2.99 0L1.4 11.28a.75.75 0 0 1-.32-.91.75.75 0 0 1 1.01-.29l5.1 2.39a1.25 1.25 0 0 0 1.62 0l5.09-2.39Z" />
      </svg>
    );
  }

  if (icon === "more") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm6.5 1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
      </svg>
    );
  }

  if (icon === "import") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M13.25 5.25a1.75 1.75 0 0 1 1.75 1.75v4.75A3.25 3.25 0 0 1 11.75 15h-5A1.75 1.75 0 0 1 5 13.25a.75.75 0 0 1 1.5 0c0 .14.11.25.25.25h5c.97 0 1.75-.78 1.75-1.75V7a.25.25 0 0 0-.25-.25.75.75 0 0 1 0-1.5ZM8.15 1c1.59.08 2.85 1.39 2.85 3V8c0 1.66-1.34 3-3 3H4a3 3 0 0 1-3-3V4c0-1.66 1.34-3 3-3h4.15ZM4 2.5A1.5 1.5 0 0 0 2.5 4V8A1.5 1.5 0 0 0 4 9.5h4A1.5 1.5 0 0 0 9.5 8V4A1.5 1.5 0 0 0 8 2.5H4Z" />
      </svg>
    );
  }

  if (icon === "invite") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8.75 4a.75.75 0 0 0-1.5 0v3.25H4a.75.75 0 0 0 0 1.5h3.25V12a.75.75 0 0 0 1.5 0V8.75H12a.75.75 0 0 0 0-1.5H8.75V4Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 1a7 7 0 0 0-2.21 13.64c.35.06.48-.15.48-.34v-1.32c-1.95.43-2.36-.95-2.36-.95-.32-.82-.78-1.03-.78-1.03-.64-.44.05-.43.05-.43.7.05 1.08.74 1.08.74.63 1.08 1.65.77 2.05.59.07-.46.25-.77.45-.95-1.55-.18-3.18-.78-3.18-3.48 0-.77.28-1.4.74-1.89-.08-.18-.32-.9.07-1.87 0 0 .61-.2 2 .73A6.8 6.8 0 0 1 8 4.08c.6 0 1.2.08 1.76.25 1.39-.93 2-.73 2-.73.39.97.15 1.69.07 1.87.46.49.74 1.12.74 1.89 0 2.71-1.64 3.3-3.2 3.47.26.22.49.65.49 1.32v1.95c0 .2.13.4.49.34A7 7 0 0 0 8 1Z" />
    </svg>
  );
};

const SearchIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M7 2a5 5 0 1 1 2.96 9.02l2.76 2.76a.75.75 0 1 1-1.06 1.06L8.9 12.08A5 5 0 0 1 7 2Zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8.75 3.5a.75.75 0 0 0-1.5 0v3.75H3.5a.75.75 0 0 0 0 1.5h3.75v3.75a.75.75 0 0 0 1.5 0V8.75h3.75a.75.75 0 0 0 0-1.5H8.75V3.5Z" />
  </svg>
);

const QuestionIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 1.5a6.5 6.5 0 1 0 0 13A6.5 6.5 0 0 0 8 1.5Zm0 11.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2.25a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Zm.02-6.8c-1.15 0-2.04.76-2.18 1.86a.75.75 0 1 0 1.49.2c.04-.35.32-.56.69-.56.41 0 .73.3.73.73 0 .32-.12.49-.5.83-.55.48-1.13.98-1.13 2v.26a.75.75 0 0 0 1.5 0v-.2c0-.38.15-.55.63-.97.52-.45 1-1 1-1.92 0-1.26-.98-2.23-2.23-2.23Z" />
  </svg>
);

export const AppShellClient = ({
  children,
  interfaceTheme,
}: AppShellClientProps) => {
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
    startVariant: SidebarVariant
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

    shellElement.style.setProperty(
      "--sidebar-spacer-width",
      `${spacerWidth}px`
    );
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

    const clampedWidth = clamp(
      finalWidth,
      SIDEBAR_MIN_WIDTH,
      SIDEBAR_MAX_WIDTH
    );
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
      startVariant === "collapsed"
        ? collapsedWidthRef.current
        : staticWidthRef.current;

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
    const nextVariant = resolveDragVariant(
      rawWidth,
      currentDragVariant,
      dragState.startVariant
    );

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

  const onRailLostPointerCapture = (
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    finishDrag(event.pointerId);
  };

  const onRailTouchStart = () => {};
  const onRailTouchMove = () => {};
  const onRailTouchEnd = () => {};

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

  const onHeaderSidebarToggle = () => {
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

  const onMainInsetClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const toggleButton = target.closest<HTMLButtonElement>(
      "[data-sidebar-toggle]"
    );

    if (!toggleButton) {
      return;
    }

    event.preventDefault();
    onHeaderSidebarToggle();
  };

  const iconMode = false;
  const sidebarState =
    variant === "static" ? "open" : isOpen ? "collapsed-hover" : "collapsed";
  const sidebarSpacerWidth =
    variant === "collapsed" ? COLLAPSED_SPACER_WIDTH : staticWidth;
  const sidebarLayerWidth =
    variant === "collapsed" ? collapsedWidth : staticWidth;
  const isCollapsedGeometry = variant === "collapsed";
  const isCollapsedDragPreview =
    isResizing && dragRef.current?.startVariant === "collapsed";
  const isCollapsedVisible =
    isCollapsedGeometry && (isOpen || isCollapsedDragPreview);

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

  const sidebarLayerModel = {
    style: sidebarLayerStyle,
    onTouchStart: onRailTouchStart,
    onTouchMove: onRailTouchMove,
    onTouchEnd: onRailTouchEnd,
    $isOpen: isOpen,
    $width: sidebarLayerWidth,
    $variant: variant,
    $collapsedGeometry: isCollapsedGeometry,
    $collapsedVisible: isCollapsedVisible,
  };

  const sidebarLayerClassName = `${styles.sidebarLayer} ${isOpen ? styles.sidebarLayerOpen : styles.sidebarLayerClosed}`;

  return (
    <div
      ref={shellRef}
      className={styles.appShell}
      data-theme={interfaceTheme}
      style={shellStyle}
    >
      <div
        className={styles.shellTrack}
        data-resizing={isResizing ? "true" : undefined}
        data-sidebar-state={sidebarState}
        data-sidebar-collapsed={variant === "collapsed" ? "true" : "false"}
      >
        <div
          className={styles.sidebarSpacer}
          style={sidebarSpacerStyle}
          aria-hidden
        />

        <div
          className={sidebarLayerClassName}
          style={sidebarLayerModel.style}
          onTouchStart={sidebarLayerModel.onTouchStart}
          onTouchMove={sidebarLayerModel.onTouchMove}
          onTouchEnd={sidebarLayerModel.onTouchEnd}
          onMouseEnter={onSidebarMouseEnter}
          onMouseLeave={onSidebarMouseLeave}
          data-icon-mode={iconMode}
          data-hover-expanded={sidebarLayerModel.$isOpen ? "true" : undefined}
          data-sidebar-variant={sidebarLayerModel.$variant}
          data-sidebar-width={sidebarLayerModel.$width}
          data-sidebar-open={sidebarLayerModel.$isOpen ? "true" : "false"}
          data-collapsed-geometry={
            sidebarLayerModel.$collapsedGeometry ? "true" : "false"
          }
          data-collapsed-visible={
            sidebarLayerModel.$collapsedVisible ? "true" : "false"
          }
        >
          <aside className={styles.sidebar} data-icon-mode={iconMode}>
            <header className={styles.sidebarHeader}>
              <div className={styles.sidebarTopRow}>
                <button type="button" className={styles.workspaceButton}>
                  <span className={styles.workspaceLogo}>NY</span>
                  <span className={styles.workspaceLabel}>nyte</span>
                  <span className={styles.workspaceChevron}>▾</span>
                </button>

                <button
                  type="button"
                  className={styles.iconActionButton}
                  aria-label="Search workspace"
                >
                  <SearchIcon />
                </button>

                <button
                  type="button"
                  className={styles.iconActionButton}
                  aria-label="Create new issue"
                >
                  <PlusIcon />
                </button>
              </div>
            </header>

            <nav
              className={styles.sidebarScrollArea}
              aria-label="Primary navigation"
            >
              <ul className={styles.sidebarList}>
                {primaryItems.map((item) => (
                  <li key={item.id}>
                    <button type="button" className={styles.sidebarItem}>
                      <span className={styles.sidebarIcon}>
                        <SidebarIcon icon={item.icon} />
                      </span>
                      <span className={styles.sidebarItemLabel}>
                        {item.label}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              {workspaceSections.map((section) => (
                <section key={section.id} className={styles.sidebarSection}>
                  <h2 className={styles.sidebarSectionTitle}>
                    <span>{section.label}</span>
                    <span className={styles.sidebarSectionCaret}>▾</span>
                  </h2>

                  {section.id === "your-teams" ? (
                    <div className={styles.teamRow}>
                      <span className={styles.teamAvatar}>●</span>
                      <span className={styles.teamLabel}>Nyte</span>
                      <span className={styles.teamCaret}>▾</span>
                    </div>
                  ) : null}

                  <ul className={styles.sidebarList}>
                    {section.items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={styles.sidebarItem}
                          data-active={item.active ? "true" : undefined}
                          data-nested={item.nested ? "true" : undefined}
                        >
                          <span className={styles.sidebarIcon}>
                            <SidebarIcon icon={item.icon} />
                          </span>
                          <span className={styles.sidebarItemLabel}>
                            {item.label}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </nav>

            <footer className={styles.sidebarFooter}>
              <button
                type="button"
                className={styles.helpButton}
                aria-label="Open help menu"
              >
                <QuestionIcon />
              </button>
            </footer>
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
            onClick={onHeaderSidebarToggle}
          />
        ) : null}

        <main className={styles.mainArea}>
          <div className={styles.mainInset} onClick={onMainInsetClick}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
