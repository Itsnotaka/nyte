"use client";

import { IconSidebar } from "@central-icons-react/round-filled-radius-2-stroke-1.5";
import { cva } from "class-variance-authority";
import { useReducedMotion } from "motion/react";
import * as React from "react";

import { useMobile } from "../../hooks/use-mobile";
import { cn } from "../../lib/utils";
import { Drawer, DrawerContent } from "./drawer";

const SIDEBAR_DESKTOP_WIDTH = 244;
const SIDEBAR_MOBILE_WIDTH = 330;
const SIDEBAR_MOBILE_BREAKPOINT = 1024;

type SidebarState = "expanded" | "collapsed";
type SidebarVariant = "static" | "collapsed" | "mobile";

type SidebarContextValue = {
  state: SidebarState;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  openMobile: boolean;
  setOpenMobile: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile: boolean;
  toggleSidebar: () => void;
  variant: SidebarVariant;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

const sidebarLayerVariants = cva("absolute overflow-hidden", {
  variants: {
    mode: {
      static:
        "inset-y-0 left-0 z-20 w-[var(--sidebar-desktop-width)] border border-transparent",
      collapsed:
        "bottom-2 left-[calc((var(--sidebar-desktop-width)+12px)*-1)] top-[37.5px] z-30 w-[var(--sidebar-desktop-width)] rounded-[5px] border border-[var(--sidebar-collapsed-border-color,var(--color-border-strong))] bg-[var(--color-sidebar-bg)] shadow-[var(--sidebar-collapsed-shadow,none)] group-focus-within/sidebar-collapsed:left-2 group-hover/sidebar-collapsed:left-2",
    },
  },
});

const sidebarBodyVariants = cva("flex h-full min-w-0 flex-col", {
  variants: {
    mode: {
      desktop: "",
      mobile: "relative",
    },
  },
  defaultVariants: {
    mode: "desktop",
  },
});

const resolveStateValue = <T,>(
  nextValue: React.SetStateAction<T>,
  currentValue: T
): T => {
  return typeof nextValue === "function"
    ? (nextValue as (value: T) => T)(currentValue)
    : nextValue;
};

type SidebarProviderProps = React.ComponentProps<"div"> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  openMobile?: boolean;
  onOpenMobileChange?: (open: boolean) => void;
};

function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  openMobile: openMobileProp,
  onOpenMobileChange,
  className,
  style,
  children,
  ...props
}: SidebarProviderProps) {
  const isMobile = useMobile(() => SIDEBAR_MOBILE_BREAKPOINT);

  const [openState, setOpenState] = React.useState(defaultOpen);
  const [openMobileState, setOpenMobileState] = React.useState(false);

  const open = openProp ?? openState;
  const openMobile = openMobileProp ?? openMobileState;

  const setOpen: React.Dispatch<React.SetStateAction<boolean>> = (nextOpen) => {
    const resolvedOpen = resolveStateValue(nextOpen, open);

    if (openProp === undefined) {
      setOpenState(resolvedOpen);
    }

    onOpenChange?.(resolvedOpen);
  };

  const setOpenMobile: React.Dispatch<React.SetStateAction<boolean>> = (
    nextOpen
  ) => {
    const resolvedOpen = resolveStateValue(nextOpen, openMobile);

    if (openMobileProp === undefined) {
      setOpenMobileState(resolvedOpen);
    }

    onOpenMobileChange?.(resolvedOpen);
  };

  const toggleSidebar = () => {
    if (isMobile) {
      setOpenMobile((currentValue) => !currentValue);
      return;
    }

    setOpen((currentValue) => !currentValue);
  };

  const state: SidebarState = open ? "expanded" : "collapsed";
  const variant: SidebarVariant = isMobile
    ? "mobile"
    : open
      ? "static"
      : "collapsed";

  const contextValue: SidebarContextValue = {
    state,
    open,
    setOpen,
    openMobile,
    setOpenMobile,
    isMobile,
    toggleSidebar,
    variant,
  };

  const shellStyle = {
    "--sidebar-desktop-width": `${SIDEBAR_DESKTOP_WIDTH}px`,
    "--sidebar-mobile-width": `min(calc(100vw - 40px), ${SIDEBAR_MOBILE_WIDTH}px)`,
    "--sidebar-transition-fast": "var(--speed-quickTransition, 0.1s)",
    "--sidebar-transition-normal": "var(--speed-regularTransition, 0.25s)",
    "--sidebar-ease":
      "var(--ease-out-cubic, cubic-bezier(0.215, 0.61, 0.355, 1))",
    "--sidebar-focus-color": "var(--color-focus)",
    "--sidebar-rail-indicator-color": "var(--color-rail)",
    "--sidebar-rail-indicator-active-color": "var(--color-icon-active)",
    "--sidebar-hover-overlay-bg": "rgba(0, 0, 0, 0.6)",
    ...style,
  } as React.CSSProperties;

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-sidebar-shell
        data-slot="sidebar-wrapper"
        className={cn("min-h-dvh w-full", className)}
        style={shellStyle}
        {...props}
      >
        <div
          data-sidebar-track
          data-slot="sidebar-track"
          data-state={state}
          data-collapsible={open ? "" : "offcanvas"}
          data-variant={variant}
          data-side="left"
          className="relative flex size-full"
        >
          {children}
        </div>
      </div>
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

type SidebarSpacerProps = {
  expanded: boolean;
  shouldReduceMotion: boolean;
};

function SidebarSpacer({ expanded, shouldReduceMotion }: SidebarSpacerProps) {
  const spacerStyle = {
    width: expanded ? "var(--sidebar-desktop-width)" : "0px",
    flexBasis: expanded ? "var(--sidebar-desktop-width)" : "0px",
    transition: shouldReduceMotion
      ? "none"
      : "width var(--sidebar-transition-fast) var(--sidebar-ease)",
  } as React.CSSProperties;

  return (
    <div
      data-sidebar-spacer
      data-slot="sidebar-gap"
      aria-hidden
      className="h-full shrink-0"
      style={spacerStyle}
    />
  );
}

type SidebarDesktopProps = React.ComponentProps<"aside"> & {
  shouldReduceMotion: boolean;
};

function SidebarDesktopStatic({
  className,
  children,
  shouldReduceMotion,
  ...props
}: SidebarDesktopProps) {
  const layerStyle = {
    transition: shouldReduceMotion
      ? "none"
      : "left var(--sidebar-transition-normal) var(--sidebar-ease)",
  } as React.CSSProperties;

  return (
    <>
      <SidebarSpacer expanded shouldReduceMotion={shouldReduceMotion} />
      <div
        data-sidebar-layer
        data-slot="sidebar-container"
        className={sidebarLayerVariants({ mode: "static" })}
        style={layerStyle}
      >
        <aside
          data-sidebar="sidebar"
          data-slot="sidebar"
          className={cn(sidebarBodyVariants({ mode: "desktop" }), className)}
          {...props}
        >
          {children}
        </aside>
      </div>
    </>
  );
}

function SidebarDesktopCollapsed({
  className,
  children,
  shouldReduceMotion,
  ...props
}: SidebarDesktopProps) {
  const { toggleSidebar } = useSidebar();

  const previewStyle = {
    transition: shouldReduceMotion
      ? "none"
      : "left var(--sidebar-transition-normal) var(--sidebar-ease)",
  } as React.CSSProperties;

  const overlayStyle = {
    transition: shouldReduceMotion
      ? "none"
      : "opacity var(--sidebar-transition-normal) var(--sidebar-ease)",
  } as React.CSSProperties;

  const edgeStyle = {
    top: "31.5px",
    bottom: "17px",
    left: "0px",
    width: "20px",
  } as React.CSSProperties;

  return (
    <>
      <SidebarSpacer expanded={false} shouldReduceMotion={shouldReduceMotion} />
      <div className="group/sidebar-collapsed absolute inset-y-0 left-0 z-20 isolate w-5">
        <div
          aria-hidden="true"
          data-sidebar-hover-overlay
          className="pointer-events-none fixed inset-0 z-10 bg-[var(--sidebar-hover-overlay-bg)] opacity-0 group-focus-within/sidebar-collapsed:opacity-100 group-hover/sidebar-collapsed:opacity-100"
          style={overlayStyle}
        />

        <button
          type="button"
          data-sidebar-edge
          aria-label="Open sidebar"
          onClick={toggleSidebar}
          className="absolute z-20 cursor-pointer border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--sidebar-focus-color)] group-focus-within/sidebar-collapsed:pointer-events-none group-hover/sidebar-collapsed:pointer-events-none"
          style={edgeStyle}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[5px] left-1/2 top-5 w-px -translate-x-1/2 rounded-full bg-[var(--sidebar-rail-indicator-color)] opacity-0 transition-[opacity,width,background-color] duration-[var(--sidebar-transition-fast)] ease-[var(--sidebar-ease)] group-hover:w-0.5 group-hover:bg-[var(--sidebar-rail-indicator-active-color)] group-hover:opacity-100 group-focus-visible:w-0.5 group-focus-visible:bg-[var(--sidebar-rail-indicator-active-color)] group-focus-visible:opacity-100"
          />
        </button>

        <div
          data-sidebar-layer
          data-slot="sidebar-container"
          className={sidebarLayerVariants({ mode: "collapsed" })}
          style={previewStyle}
        >
          <aside
            data-sidebar="sidebar"
            data-slot="sidebar"
            className={cn(sidebarBodyVariants({ mode: "desktop" }), className)}
            {...props}
          >
            {children}
          </aside>
        </div>
      </div>
    </>
  );
}

function SidebarMobileDrawer({
  className,
  children,
  ...props
}: React.ComponentProps<"aside">) {
  const { openMobile, setOpenMobile } = useSidebar();

  return (
    <>
      <SidebarSpacer expanded={false} shouldReduceMotion={false} />
      <Drawer
        open={openMobile}
        onOpenChange={setOpenMobile}
        direction="left"
        modal
      >
        <DrawerContent
          data-slot="sidebar-container"
          className="gap-0 overflow-hidden border-r border-[var(--sidebar-collapsed-border-color,var(--color-border-strong))] p-0 data-[vaul-drawer-direction=left]:w-[var(--sidebar-mobile-width)] data-[vaul-drawer-direction=left]:max-w-[var(--sidebar-mobile-width)] data-[vaul-drawer-direction=left]:rounded-none data-[vaul-drawer-direction=left]:sm:max-w-none"
        >
          <aside
            data-sidebar="sidebar"
            data-slot="sidebar"
            className={cn(sidebarBodyVariants({ mode: "mobile" }), className)}
            {...props}
          >
            {children}
          </aside>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function Sidebar({
  className,
  children,
  ...props
}: React.ComponentProps<"aside">) {
  const { isMobile, state } = useSidebar();
  const shouldReduceMotion = useReducedMotion() ?? false;

  if (isMobile) {
    return (
      <SidebarMobileDrawer className={className} {...props}>
        {children}
      </SidebarMobileDrawer>
    );
  }

  if (state === "expanded") {
    return (
      <SidebarDesktopStatic
        className={className}
        shouldReduceMotion={shouldReduceMotion}
        {...props}
      >
        {children}
      </SidebarDesktopStatic>
    );
  }

  return (
    <SidebarDesktopCollapsed
      className={className}
      shouldReduceMotion={shouldReduceMotion}
      {...props}
    >
      {children}
    </SidebarDesktopCollapsed>
  );
}

function SidebarRail({
  className,
  onClick,
  ...props
}: React.ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar();

  const railStyle = {
    right: "-5px",
    top: "14px",
    bottom: "14px",
  } as React.CSSProperties;

  return (
    <button
      type="button"
      data-sidebar="rail"
      data-slot="sidebar-rail"
      className={cn(
        "group absolute z-[25] w-[10px] cursor-pointer border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--sidebar-focus-color)]",
        className
      )}
      style={railStyle}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) {
          return;
        }

        toggleSidebar();
      }}
      {...props}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 rounded-full bg-[var(--sidebar-rail-indicator-color)] opacity-0 transition-[opacity,width,background-color] duration-[var(--sidebar-transition-fast)] ease-[var(--sidebar-ease)] group-hover:w-0.5 group-hover:bg-[var(--sidebar-rail-indicator-active-color)] group-hover:opacity-100 group-focus-visible:w-0.5 group-focus-visible:bg-[var(--sidebar-rail-indicator-active-color)] group-focus-visible:opacity-100"
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
  const { state, isMobile } = useSidebar();
  const shouldReduceMotion = useReducedMotion() ?? false;

  const insetStyle = {
    paddingTop: "var(--shell-gutter, 8px)",
    paddingRight: "var(--shell-gutter, 8px)",
    paddingBottom: "var(--shell-gutter, 8px)",
    paddingLeft:
      !isMobile && state === "expanded" ? 0 : "var(--shell-gutter, 8px)",
    transition: shouldReduceMotion
      ? "none"
      : "padding-left var(--sidebar-transition-normal) var(--sidebar-ease)",
    ...style,
  } as React.CSSProperties;

  const insetInnerStyle = {
    borderRadius: "var(--shell-inset-radius, 8px)",
  } as React.CSSProperties;

  return (
    <main
      data-sidebar-inset
      data-slot="sidebar-inset"
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
      data-sidebar="header"
      data-slot="sidebar-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-sidebar="footer"
      data-slot="sidebar-footer"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-sidebar="content"
      data-slot="sidebar-content"
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
  hideWhenExpanded = false,
  children,
  type,
  ...props
}: SidebarTriggerProps) {
  const { state, isMobile, toggleSidebar } = useSidebar();

  if (hideWhenExpanded && !isMobile && state === "expanded") {
    return null;
  }

  return (
    <button
      type={type ?? "button"}
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      className={cn(
        "absolute left-3 top-2 z-[2] inline-flex size-6.5 items-center justify-center rounded-[5px] border-0 bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-control-bg-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--sidebar-focus-color)]",
        className
      )}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) {
          return;
        }

        toggleSidebar();
      }}
      {...props}
    >
      {children ?? <IconSidebar className="size-4" aria-hidden="true" />}
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
