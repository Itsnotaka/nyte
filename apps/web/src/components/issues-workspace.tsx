"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import styles from "./issues-workspace.module.scss";

type SidebarItem = {
  id: string;
  label: string;
  count?: number;
};

type SidebarSection = {
  id: string;
  label: string;
  items: SidebarItem[];
};

type StatusTone = "done" | "started" | "blocked" | "backlog";

type Issue = {
  id: string;
  key: string;
  title: string;
  team: string;
  status: string;
  statusTone: StatusTone;
  priority: "P0" | "P1" | "P2" | "P3";
  estimate: number;
  assignee: string;
  updated: string;
  description: string;
};

type SidebarSectionProps = {
  section: SidebarSection;
  activeItemId: string;
  onSelect: (itemId: string) => void;
};

type IssueRowProps = {
  issue: Issue;
  selected: boolean;
  onSelect: (issueId: string) => void;
};

const SIDEBAR_WIDTH = 244;
const SIDEBAR_HOVER_ZONE_WIDTH = 12;
const SIDEBAR_CLOSE_DELAY = 90;

const sidebarSections: SidebarSection[] = [
  {
    id: "views",
    label: "Views",
    items: [
      { id: "inbox", label: "Inbox", count: 3 },
      { id: "my-issues", label: "My issues", count: 12 },
      { id: "created-by-me", label: "Created by me", count: 8 },
      { id: "backlog", label: "Backlog", count: 34 },
    ],
  },
  {
    id: "teams",
    label: "Teams",
    items: [
      { id: "product", label: "Product", count: 14 },
      { id: "core", label: "Core", count: 18 },
      { id: "design", label: "Design", count: 5 },
      { id: "growth", label: "Growth", count: 11 },
    ],
  },
];

const issues: Issue[] = [
  {
    id: "1",
    key: "NYT-482",
    title: "Improve command composer discoverability for first-time users",
    team: "Product",
    status: "In Progress",
    statusTone: "started",
    priority: "P1",
    estimate: 3,
    assignee: "AK",
    updated: "6m",
    description:
      "Rework the issue composer entry point so first-time users can immediately discover command-based workflows. Keep parity with existing keyboard interactions and preserve fast-path issue creation.",
  },
  {
    id: "2",
    key: "NYT-477",
    title: "Switch onboarding to single-step auth and workspace bootstrap",
    team: "Core",
    status: "Backlog",
    statusTone: "backlog",
    priority: "P2",
    estimate: 5,
    assignee: "LS",
    updated: "18m",
    description:
      "Streamline onboarding into one intent-driven path with immediate workspace provisioning and no duplicate confirmation surfaces.",
  },
  {
    id: "3",
    key: "NYT-470",
    title: "Fix keyboard focus loss when quick switching between views",
    team: "Core",
    status: "Blocked",
    statusTone: "blocked",
    priority: "P0",
    estimate: 2,
    assignee: "BT",
    updated: "31m",
    description:
      "Eliminate focus drops between list and detail contexts when users rapidly switch views using keyboard navigation.",
  },
  {
    id: "4",
    key: "NYT-462",
    title: "Refresh sidebar hierarchy for nested spaces and private views",
    team: "Design",
    status: "Done",
    statusTone: "done",
    priority: "P2",
    estimate: 2,
    assignee: "RM",
    updated: "1h",
    description:
      "Refine navigation hierarchy to preserve density while improving structure clarity for nested and personal scopes.",
  },
  {
    id: "5",
    key: "NYT-458",
    title: "Add issue split view with persisted width and sticky detail header",
    team: "Product",
    status: "In Progress",
    statusTone: "started",
    priority: "P1",
    estimate: 8,
    assignee: "GW",
    updated: "2h",
    description:
      "Provide persistent split ratios and a stable detail header so list navigation remains contextual while reading issue details.",
  },
  {
    id: "6",
    key: "NYT-451",
    title: "Enable drag-to-plan from backlog into current sprint",
    team: "Growth",
    status: "Backlog",
    statusTone: "backlog",
    priority: "P3",
    estimate: 3,
    assignee: "JM",
    updated: "3h",
    description:
      "Allow planning by dragging issues directly from backlog into sprint targets without leaving the primary workspace.",
  },
];

const toneClass: Record<StatusTone, string> = {
  done: styles.toneDone,
  started: styles.toneStarted,
  blocked: styles.toneBlocked,
  backlog: styles.toneBacklog,
};

const SidebarSectionBlock = ({ section, activeItemId, onSelect }: SidebarSectionProps) => {
  return (
    <section className={styles.sidebarSection}>
      <h2 className={styles.sidebarSectionLabel}>{section.label}</h2>
      <ul className={styles.sidebarList}>
        {section.items.map((item) => {
          const active = item.id === activeItemId;

          return (
            <li key={item.id}>
              <button
                type="button"
                className={styles.sidebarItemButton}
                data-active={active}
                onClick={() => {
                  onSelect(item.id);
                }}
              >
                <span className={styles.sidebarItemText}>{item.label}</span>
                {item.count ? <span className={styles.sidebarItemCount}>{item.count}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

const IssueRow = ({ issue, selected, onSelect }: IssueRowProps) => {
  return (
    <li>
      <button
        type="button"
        className={styles.issueRow}
        data-selected={selected}
        onClick={() => {
          onSelect(issue.id);
        }}
      >
        <span className={styles.issueKey}>{issue.key}</span>
        <span className={styles.issueTitleCell}>
          <span className={styles.issueTitle}>{issue.title}</span>
          <span className={styles.issueTeam}>{issue.team}</span>
        </span>
        <span className={styles.issueStatusCell}>
          <span className={styles.issueStatusPill}>
            <span className={`${styles.issueStatusDot} ${toneClass[issue.statusTone]}`} />
            {issue.status}
          </span>
        </span>
        <span className={styles.issueEstimate}>{issue.estimate}</span>
        <span className={styles.issueUpdated}>{issue.updated}</span>
      </button>
    </li>
  );
};

export const IssuesWorkspace = () => {
  const [activeSidebarItemId, setActiveSidebarItemId] = useState("my-issues");
  const [selectedIssueId, setSelectedIssueId] = useState(issues[0]?.id ?? "");
  const [supportsHover, setSupportsHover] = useState(true);
  const [hoverOpen, setHoverOpen] = useState(false);

  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");

    const sync = () => {
      setSupportsHover(query.matches);
    };

    sync();
    query.addEventListener("change", sync);

    return () => {
      query.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
      }
    };
  }, []);

  const selectedIssue = useMemo(
    () => issues.find((issue) => issue.id === selectedIssueId) ?? issues[0],
    [selectedIssueId],
  );

  const sidebarOpen = !supportsHover || hoverOpen;

  const clearCloseTimer = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const openSidebar = () => {
    clearCloseTimer();
    if (supportsHover) {
      setHoverOpen(true);
    }
  };

  const closeSidebar = () => {
    if (!supportsHover) {
      return;
    }

    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => {
      setHoverOpen(false);
    }, SIDEBAR_CLOSE_DELAY);
  };

  return (
    <div className={styles.root}>
      <aside
        className={styles.sidebarOverlay}
        onPointerEnter={openSidebar}
        onPointerLeave={closeSidebar}
      >
        {supportsHover ? (
          <div className={styles.sidebarHoverZone} onPointerEnter={openSidebar} />
        ) : null}

        <motion.nav
          className={styles.sidebarPanel}
          initial={false}
          animate={{ x: sidebarOpen ? 0 : -SIDEBAR_WIDTH + SIDEBAR_HOVER_ZONE_WIDTH }}
          transition={{ type: "spring", stiffness: 480, damping: 44, mass: 0.75 }}
        >
          <header className={styles.sidebarHeader}>
            <button type="button" className={styles.workspaceSwitcher}>
              <span className={styles.workspaceIcon}>N</span>
              <span className={styles.workspaceLabel}>Nyte</span>
              <span className={styles.workspaceShortcut}>⌘K</span>
            </button>
          </header>

          <div className={styles.sidebarContent}>
            {sidebarSections.map((section) => (
              <SidebarSectionBlock
                key={section.id}
                section={section}
                activeItemId={activeSidebarItemId}
                onSelect={setActiveSidebarItemId}
              />
            ))}
          </div>

          <footer className={styles.sidebarFooter}>
            <button type="button" className={styles.userButton}>
              <span className={styles.userAvatar}>AK</span>
              <span className={styles.userName}>Akash</span>
            </button>
          </footer>
        </motion.nav>
      </aside>

      <main className={styles.main} data-sidebar-open={sidebarOpen}>
        <header className={styles.header}>
          <div className={styles.breadcrumb}>Nyte / Issues</div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.filterButton}>
              Filters
            </button>
            <button type="button" className={styles.newIssueButton}>
              New issue
            </button>
          </div>
        </header>

        <div className={styles.body}>
          <section className={styles.listPane}>
            <div className={styles.listHeader}>
              <span className={styles.columnKey}>Key</span>
              <span className={styles.columnTitle}>Title</span>
              <span className={styles.columnStatus}>Status</span>
              <span className={styles.columnEstimate}>Est.</span>
              <span className={styles.columnUpdated}>Updated</span>
            </div>

            <ul className={styles.issueList}>
              {issues.map((issue) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  selected={issue.id === selectedIssue.id}
                  onSelect={setSelectedIssueId}
                />
              ))}
            </ul>
          </section>

          <section className={styles.detailPane}>
            <header className={styles.detailHeader}>
              <span className={styles.detailKey}>{selectedIssue.key}</span>
              <h1 className={styles.detailTitle}>{selectedIssue.title}</h1>
            </header>

            <div className={styles.detailMetaGrid}>
              <div>
                <p className={styles.metaLabel}>Status</p>
                <p className={styles.metaValue}>
                  <span
                    className={`${styles.issueStatusDot} ${toneClass[selectedIssue.statusTone]}`}
                  />
                  {selectedIssue.status}
                </p>
              </div>
              <div>
                <p className={styles.metaLabel}>Priority</p>
                <p className={styles.metaValue}>{selectedIssue.priority}</p>
              </div>
              <div>
                <p className={styles.metaLabel}>Assignee</p>
                <p className={styles.metaValue}>{selectedIssue.assignee}</p>
              </div>
              <div>
                <p className={styles.metaLabel}>Estimate</p>
                <p className={styles.metaValue}>{selectedIssue.estimate} points</p>
              </div>
            </div>

            <div className={styles.detailBody}>
              <div className={styles.descriptionCard}>
                <h2 className={styles.descriptionTitle}>Description</h2>
                <p className={styles.descriptionText}>{selectedIssue.description}</p>
                <p className={styles.descriptionText}>
                  Dense hierarchy, compact metadata, and persistent context mirror the Linear issue
                  layout model.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};
