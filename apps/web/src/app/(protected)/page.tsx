import styles from "./page.module.scss";

const PlusIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8.75 3.5a.75.75 0 0 0-1.5 0v3.75H3.5a.75.75 0 0 0 0 1.5h3.75v3.75a.75.75 0 0 0 1.5 0V8.75h3.75a.75.75 0 0 0 0-1.5H8.75V3.5Z" />
  </svg>
);

const SlidersIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M7 2.5c1.12 0 2.06.74 2.38 1.75h5.12a.75.75 0 0 1 0 1.5H9.38A2.5 2.5 0 1 1 7 2.5Zm0 1.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm3 4.5c1.12 0 2.06.74 2.38 1.75h2.12a.75.75 0 0 1 0 1.5h-2.12A2.5 2.5 0 1 1 10 8.5Zm0 1.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
  </svg>
);

const SidebarToggleIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M15 5.25A3.25 3.25 0 0 0 11.75 2h-7.5A3.25 3.25 0 0 0 1 5.25v5.5A3.25 3.25 0 0 0 4.25 14h7.5A3.25 3.25 0 0 0 15 10.75v-5.5Zm-3.5 7.25H7v-9h4.5a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2Zm-6 0H4.25a1.75 1.75 0 0 1-1.75-1.75v-5.5c0-.966.784-1.75 1.75-1.75H5.5v9Z" />
  </svg>
);

const EmptyViewsIllustration = () => (
  <svg viewBox="15 14 92 112" fill="none" aria-label="Empty custom views list illustration">
    <path
      d="M20 110.4a2 2 0 0 1-1.26-1.85v-2.5a3 3 0 0 1 2.7-2.99L105 94.75v4.4a2 2 0 0 1-1 1.73l-41.78 24a6 6 0 0 1-5.22.37l-37-14.84Z"
      fill="lch(4.8% 0.7 272)"
      stroke="lch(19% 3.54 272 / 1)"
      strokeWidth="1.5"
    />
    <path
      d="M19.88 106.41a2 2 0 0 1-.27-3.6L61.8 78.5a6 6 0 0 1 5.18-.4l37.13 14.5a2 2 0 0 1 .27 3.6L62.2 120.5a6 6 0 0 1-5.18.4l-37.13-14.5Z"
      fill="lch(4.8% 0.7 272)"
      stroke="lch(19% 3.54 272 / 1)"
      strokeWidth="1.5"
    />
    <path
      d="M20 99.46a2 2 0 0 1-1.26-1.86v-2.5a3 3 0 0 1 2.7-2.99L105 83.8v4.4a2 2 0 0 1-1 1.73l-41.78 24a6 6 0 0 1-5.22.37L20 99.46Z"
      fill="lch(4.8% 0.7 272)"
      stroke="lch(38.29% 1.35 272 / 1)"
      strokeWidth="1.5"
    />
    <path
      d="M19.88 95.46a2 2 0 0 1-.27-3.6l42.2-24.33a6 6 0 0 1 5.18-.39l37.13 14.5a2 2 0 0 1 .27 3.6l-42.2 24.32a6 6 0 0 1-5.18.4l-37.13-14.5Z"
      fill="lch(4.8% 0.7 272)"
      stroke="lch(38.29% 1.35 272 / 1)"
      strokeWidth="1.5"
    />
    <path
      d="M20 88.5a2 2 0 0 1-1.26-1.85v-2.5a3 3 0 0 1 2.7-3l83.55-8.3v4.4a2 2 0 0 1-1 1.73l-41.78 24a6 6 0 0 1-5.22.36l-37-14.84Z"
      fill="lch(4.8% 0.7 272)"
      stroke="lch(62.6% 1.35 272 / 1)"
      strokeWidth="1.5"
    />
    <path
      d="M19.88 84.5a2 2 0 0 1-.27-3.59l42.2-24.33A6 6 0 0 1 67 56.2l37.13 14.5a2 2 0 0 1 .27 3.59L62.2 98.6a6 6 0 0 1-5.2.4L19.88 84.5Z"
      fill="lch(4.8% 0.7 272)"
      stroke="lch(62.6% 1.35 272 / 1)"
      strokeWidth="1.5"
    />
    <path
      d="M20.14 72.9a2 2 0 0 1-2.02-.99l-1.25-2.16a3 3 0 0 1 .85-3.94l68.2-48.97 2.2 3.8a2 2 0 0 1 0 2.01L63.94 64.32a6 6 0 0 1-4.34 2.93l-39.46 5.64Z"
      fill="lch(4.8% 0.7 272)"
      stroke="lch(90.65% 1.35 272 / 1)"
      strokeWidth="1.5"
    />
    <path
      d="M18.04 69.49a2 2 0 0 1-2.03-2.98L40.4 24.34a6 6 0 0 1 4.29-2.93l39.4-6.01a2 2 0 0 1 2.03 2.98L61.73 60.55a6 6 0 0 1-4.29 2.93l-39.4 6.01Z"
      fill="lch(4.8% 0.7 272)"
      stroke="lch(90.65% 1.35 272 / 1)"
      strokeWidth="1.5"
    />
  </svg>
);

export default function App() {
  return (
    <section className={styles.viewsPage} data-loading-caret="true">
      <header className={styles.viewsHeader}>
        <div className={styles.viewsHeaderTop}>
          <div className={styles.viewsHeaderTitleGroup}>
            <button
              type="button"
              className={styles.headerSidebarToggle}
              data-sidebar-toggle="true"
              aria-label="Toggle sidebar"
            >
              <SidebarToggleIcon />
            </button>
            <h2 className={styles.viewsTitle}>Views</h2>
          </div>

          <button type="button" className={styles.headerActionButton}>
            <span className={styles.headerActionIcon}>
              <PlusIcon />
            </span>
            <span>New view</span>
          </button>
        </div>

        <div className={styles.viewsHeaderBottom}>
          <div className={styles.viewTabGroup}>
            <button type="button" className={styles.viewTab} data-active="true">
              Issues
            </button>
            <button type="button" className={styles.viewTab}>
              Projects
            </button>
          </div>

          <button type="button" className={styles.headerActionButton}>
            <span className={styles.headerActionIcon}>
              <SlidersIcon />
            </span>
            <span>Display</span>
          </button>
        </div>
      </header>

      <div className={styles.viewsCanvas}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIllustration}>
            <EmptyViewsIllustration />
          </div>

          <h3 className={styles.emptyTitle}>Views</h3>

          <div className={styles.emptyCopy}>
            <p>
              Create custom views using filters to show only the issues you want to see. You can
              save, share, and favorite these views for easy access and faster team collaboration.
            </p>
            <p>
              You can also save any existing view by clicking the icon or by pressing
              <span className={styles.keyCombo}>
                <kbd>⌥</kbd>
                <kbd>V</kbd>
              </span>
              .
            </p>
          </div>

          <div className={styles.emptyActions}>
            <button type="button" className={styles.primaryButton}>
              Create new view
            </button>
            <a
              href="https://linear.app/docs/custom-views"
              target="_blank"
              rel="noreferrer"
              className={styles.secondaryButton}
            >
              Documentation
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
