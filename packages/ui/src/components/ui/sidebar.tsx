"use client";

import { IconSidebar } from "@central-icons-react/round-outlined-radius-2-stroke-1.5";
import { cva } from "class-variance-authority";
import * as React from "react";

import { useMobile } from "../../hooks/use-mobile";
import { cn } from "../../lib/utils";
import { Drawer, DrawerContent } from "./drawer";

const SIDEBAR_DESKTOP_WIDTH = 244;
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
      static: "inset-y-0 left-0 z-20 w-[var(--sidebar-desktop-width)] border border-transparent",
      collapsed:
        "top-[37.5px] bottom-2 left-[calc((var(--sidebar-desktop-width)+12px)*-1)] z-30 w-[var(--sidebar-desktop-width)] rounded-[5px] border border-sachi-line bg-sachi-sidebar shadow-[var(--sidebar-collapsed-shadow,none)] group-focus-within/sidebar-collapsed:left-2 group-hover/sidebar-collapsed:left-2",
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

const resolveStateValue = <T,>(nextValue: React.SetStateAction<T>, currentValue: T): T => {
  return typeof nextValue === "function" ? (nextValue as (value: T) => T)(currentValue) : nextValue;
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

  const setOpenMobile: React.Dispatch<React.SetStateAction<boolean>> = (nextOpen) => {
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
  const variant: SidebarVariant = isMobile ? "mobile" : open ? "static" : "collapsed";

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
    "--sidebar-transition-fast": "var(--speed-quickTransition, 0.1s)",
    "--sidebar-ease": "var(--ease-out, cubic-bezier(0.25, 0.1, 0.25, 1))",
    ...style,
  } as React.CSSProperties;

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-sidebar-shell
        data-slot="sidebar-wrapper"
        className={cn("flex h-svh min-h-0 w-full flex-col overflow-hidden", className)}
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
          className="relative flex min-h-0 w-full min-w-0 flex-1 flex-row"
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
};

function SidebarSpacer({ expanded }: SidebarSpacerProps) {
  return (
    <div
      data-sidebar-spacer
      data-slot="sidebar-gap"
      aria-hidden
      className={cn(
        "h-full shrink-0",
        expanded
          ? "w-[var(--sidebar-desktop-width)] basis-[var(--sidebar-desktop-width)]"
          : "w-0 basis-0",
      )}
    />
  );
}

type SidebarDesktopProps = React.ComponentProps<"aside">;

function SidebarDesktopStatic({ className, children, ...props }: SidebarDesktopProps) {
  return (
    <>
      <SidebarSpacer expanded />
      <div
        data-sidebar-layer
        data-slot="sidebar-container"
        className={cn(sidebarLayerVariants({ mode: "static" }), "h-full")}
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

function SidebarDesktopCollapsed({ className, children, ...props }: SidebarDesktopProps) {
  const { toggleSidebar } = useSidebar();

  return (
    <>
      <SidebarSpacer expanded={false} />
      <div className="group/sidebar-collapsed absolute inset-y-0 left-0 isolate z-20 w-5">
        <div
          aria-hidden="true"
          data-sidebar-hover-overlay
          className="pointer-events-none fixed inset-0 z-10 bg-sachi-overlay opacity-0 group-focus-within/sidebar-collapsed:opacity-100 group-hover/sidebar-collapsed:opacity-100"
        />

        <button
          type="button"
          data-sidebar-edge
          aria-label="Open sidebar"
          onClick={toggleSidebar}
          className="absolute top-[31.5px] bottom-[17px] left-0 z-20 w-5 cursor-pointer border-0 bg-transparent p-0 group-focus-within/sidebar-collapsed:pointer-events-none group-hover/sidebar-collapsed:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sachi-focus"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-5 bottom-[5px] left-1/2 w-px -translate-x-1/2 rounded-full bg-sachi-rail opacity-0 transition-[opacity,width,background-color] duration-[var(--sidebar-transition-fast)] ease-[var(--sidebar-ease)] group-hover:w-0.5 group-hover:bg-sachi-accent group-hover:opacity-100 group-focus-visible:w-0.5 group-focus-visible:bg-sachi-accent group-focus-visible:opacity-100"
          />
        </button>

        <div
          data-sidebar-layer
          data-slot="sidebar-container"
          className={cn(sidebarLayerVariants({ mode: "collapsed" }), "h-full")}
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

function SidebarMobileDrawer({ className, children, ...props }: React.ComponentProps<"aside">) {
  const { openMobile, setOpenMobile } = useSidebar();

  return (
    <>
      <SidebarSpacer expanded={false} />
      <Drawer open={openMobile} onOpenChange={setOpenMobile} swipeDirection="right" modal>
        <DrawerContent
          data-slot="sidebar-container"
          className="min-h-0 gap-0 overflow-hidden border-r border-sachi-line bg-sachi-sidebar p-0 data-[swipe-direction=right]:rounded-none"
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

function Sidebar({ className, children, ...props }: React.ComponentProps<"aside">) {
  const { isMobile, state } = useSidebar();

  if (isMobile) {
    return (
      <SidebarMobileDrawer className={className} {...props}>
        {children}
      </SidebarMobileDrawer>
    );
  }

  if (state === "expanded") {
    return (
      <SidebarDesktopStatic className={className} {...props}>
        {children}
      </SidebarDesktopStatic>
    );
  }

  return (
    <SidebarDesktopCollapsed className={className} {...props}>
      {children}
    </SidebarDesktopCollapsed>
  );
}

function SidebarRail({ className, onClick, ...props }: React.ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      data-sidebar="rail"
      data-slot="sidebar-rail"
      className={cn(
        "group absolute top-[14px] right-[-5px] bottom-[14px] z-[25] w-[10px] cursor-pointer border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sachi-focus",
        className,
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
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 rounded-full bg-sachi-rail opacity-0 transition-[opacity,width,background-color] duration-[var(--sidebar-transition-fast)] ease-[var(--sidebar-ease)] group-hover:w-0.5 group-hover:bg-sachi-accent group-hover:opacity-100 group-focus-visible:w-0.5 group-focus-visible:bg-sachi-accent group-focus-visible:opacity-100"
      />
    </button>
  );
}

function SidebarInset({ className, style, children, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-sidebar-inset
      data-slot="sidebar-inset"
      className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden", className)}
      style={style}
      {...props}
    >
      <div
        data-sidebar-inset-inner
        className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--shell-inset-radius,8px)] border border-sachi-line bg-sachi-base"
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
  layout?: "floating" | "inline";
};

function SidebarTrigger({
  className,
  onClick,
  hideWhenExpanded = false,
  layout = "floating",
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
        "inline-flex size-6.5 items-center justify-center rounded-[5px] border-0 bg-transparent text-sachi-foreground-muted hover:bg-sachi-fill-hover hover:text-sachi-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sachi-focus",
        layout === "floating" ? "absolute top-2 left-3 z-[2]" : "relative z-[1] -ml-0.5 shrink-0",
        className,
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

const insetViewVariants = cva("mx-auto flex h-full w-full flex-col gap-4 px-4 pt-4 pb-6 sm:px-6", {
  variants: {
    maxWidth: {
      sm: "max-w-[640px]",
      md: "max-w-[768px]",
      lg: "max-w-[1024px]",
      xl: "max-w-[1280px]",
      "2xl": "max-w-[1536px]",
      full: "max-w-none",
    },
  },
  defaultVariants: {
    maxWidth: "xl",
  },
});

type InsetViewProps = React.ComponentProps<"section"> & {
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
};

function InsetView({ className, maxWidth = "xl", children, ...props }: InsetViewProps) {
  return (
    <section
      data-slot="inset-view"
      className={cn("h-full min-h-0 overflow-auto bg-sachi-base", className)}
      {...props}
    >
      <div className={insetViewVariants({ maxWidth })}>{children}</div>
    </section>
  );
}

export {
  InsetView,
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
