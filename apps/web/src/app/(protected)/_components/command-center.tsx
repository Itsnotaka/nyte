"use client";

import { NotificationFeed } from "./notification-feed";

export function CommandCenter() {
  return (
    <section className="min-h-0 flex flex-1 flex-col gap-3">
      <h2 className="text-sm text-[var(--color-text-primary)]">Review & Reply</h2>
      <NotificationFeed />
    </section>
  );
}
