"use client";

import * as React from "react";
import {
  BellDotIcon,
  CalendarCheck2Icon,
  CalendarClockIcon,
  ChevronRightIcon,
  Clock3Icon,
  DraftingCompassIcon,
  InboxIcon,
  Layers2Icon,
  MailIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  SparklesIcon,
  WalletIcon,
} from "lucide-react";

import { mockIntakeSignals } from "@/lib/domain/mock-intake";
import { createNeedsYouQueue, GATE_LABEL, type WorkItem } from "@/lib/domain/triage";
import { Badge } from "@workspace/ui/@/components/ui/badge";
import { Button } from "@workspace/ui/@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/@/components/ui/card";
import { Input } from "@workspace/ui/@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/@/components/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@workspace/ui/@/components/ui/sidebar";
import { Textarea } from "@workspace/ui/@/components/ui/textarea";

const REFERENCE_NOW = new Date("2026-01-20T12:00:00.000Z");

const navItems = [
  { id: "needs-you", label: "Needs You", icon: BellDotIcon },
  { id: "drafts", label: "Drafts", icon: DraftingCompassIcon, count: 8 },
  { id: "processed", label: "Processed", icon: Layers2Icon, count: 27 },
  { id: "connections", label: "Connections", icon: RefreshCwIcon, count: undefined },
  { id: "rules", label: "Rules", icon: ShieldAlertIcon, count: undefined },
] as const;

function sourceIcon(type: WorkItem["type"]) {
  if (type === "calendar") {
    return <CalendarClockIcon className="size-4" />;
  }

  if (type === "refund") {
    return <WalletIcon className="size-4" />;
  }

  return <MailIcon className="size-4" />;
}

export function NyteShell() {
  const needsYouItems = React.useMemo(
    () => createNeedsYouQueue(mockIntakeSignals, REFERENCE_NOW),
    [],
  );
  const needsYouCount = needsYouItems.length;
  const [activeNav, setActiveNav] = React.useState<(typeof navItems)[number]["id"]>("needs-you");
  const [activeItem, setActiveItem] = React.useState<WorkItem | null>(needsYouItems.at(0) ?? null);

  return (
    <SidebarProvider>
      <Sidebar variant="inset">
        <SidebarHeader>
          <Button variant="ghost" className="justify-start">
            <SparklesIcon />
            <span>Nyte</span>
          </Button>
          <div className="px-2">
            <Input defaultValue="Gmail draft an email to our largest customer about renewal timeline and next steps" />
          </div>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Supervisor Console</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const badgeCount = item.id === "needs-you" ? needsYouCount : item.count;

                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={activeNav === item.id}
                        onClick={() => setActiveNav(item.id)}
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      {badgeCount !== undefined ? (
                        <SidebarMenuBadge>{badgeCount}</SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <Card size="sm" className="bg-sidebar-accent/60 border-sidebar-border gap-2">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm">v1 policy</CardTitle>
            </CardHeader>
            <CardContent className="text-sidebar-foreground/80 text-xs">
              Email is read-only + draft-only. Calendar creates events only after your explicit
              approval.
            </CardContent>
          </Card>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-col gap-6 p-4 md:p-6">
          <header className="bg-card ring-border/70 flex items-center gap-3 rounded-xl p-3 ring-1">
            <SidebarTrigger />
            <div className="w-full space-y-2">
              <div className="flex items-center gap-2">
                <Input defaultValue="Gmail draft an email to our largest customer about the renewal timeline and next steps" />
                <Button>Go</Button>
              </div>
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <span>@ Add context</span>
                <Badge variant="secondary">Gmail</Badge>
                <Badge variant="secondary">Calendar</Badge>
              </div>
            </div>
          </header>

          <section className="space-y-3">
            {needsYouItems.map((item) => (
              <Card key={item.id} className="gap-3">
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    <Badge variant="outline">{item.actor}</Badge>
                    <span className="text-muted-foreground text-sm">from {item.source}</span>
                  </CardTitle>
                  <p className="text-muted-foreground text-sm">{item.summary}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm">{item.context}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.gates.map((gate) => (
                      <Badge key={gate} variant="secondary">
                        {GATE_LABEL[gate]}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="justify-between">
                  <Button
                    variant="ghost"
                    className="justify-start px-0 text-sm"
                    onClick={() => setActiveItem(item)}
                  >
                    {sourceIcon(item.type)}
                    <span>{item.actionLabel}</span>
                    <ChevronRightIcon className="size-4" />
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setActiveItem(item)}>
                      {item.secondaryLabel}
                    </Button>
                    <Button onClick={() => setActiveItem(item)}>
                      {item.type === "calendar" ? (
                        <CalendarCheck2Icon />
                      ) : item.type === "refund" ? (
                        <WalletIcon />
                      ) : (
                        <InboxIcon />
                      )}
                      {item.cta}
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </section>
        </div>
      </SidebarInset>

      <Sheet
        open={Boolean(activeItem)}
        onOpenChange={(open) => (!open ? setActiveItem(null) : undefined)}
      >
        <SheetContent side="right" className="sm:max-w-lg">
          {activeItem ? (
            <>
              <SheetHeader>
                <SheetTitle>{activeItem.actionLabel}</SheetTitle>
                <SheetDescription>{activeItem.preview}</SheetDescription>
              </SheetHeader>

              <div className="space-y-4 px-4">
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs uppercase">Actor</p>
                  <Input value={activeItem.actor} readOnly />
                </div>

                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs uppercase">Summary</p>
                  <Textarea defaultValue={activeItem.summary} />
                </div>

                {activeItem.type === "calendar" ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <p className="text-muted-foreground text-xs uppercase">Date</p>
                        <Input defaultValue="2026-01-22" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-muted-foreground text-xs uppercase">Time</p>
                        <Input defaultValue="14:00" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-xs uppercase">Attendees</p>
                      <Input defaultValue="rachel@company.com, team@nyte.ai" />
                    </div>
                  </>
                ) : null}

                {activeItem.type === "draft" ? (
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-xs uppercase">Draft body</p>
                    <Textarea defaultValue={activeItem.preview} className="min-h-44" />
                  </div>
                ) : null}
              </div>

              <SheetFooter className="sm:flex-row sm:justify-between">
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Clock3Icon className="size-3.5" />
                  strict-gate validated
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setActiveItem(null)}>
                    Dismiss
                  </Button>
                  <Button onClick={() => setActiveItem(null)}>{activeItem.cta}</Button>
                </div>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  );
}
