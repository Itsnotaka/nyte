"use client";

import type { WorkItemWithAction } from "@nyte/domain/actions";
import { useForm } from "@tanstack/react-form";
import { CalendarDaysIcon, MailIcon, WalletCardsIcon, XIcon } from "lucide-react";

import {
  actionContentViewModel,
  primaryActionLabel,
  secondaryActionLabel,
} from "~/lib/queue/presenters";

type ActionCardProps = {
  item: WorkItemWithAction;
  onApprove: (item: WorkItemWithAction, payloadOverride?: WorkItemWithAction["proposedAction"]) => void;
  onDismiss: (item: WorkItemWithAction) => void;
};

function TypeBadge({ item }: { item: WorkItemWithAction }) {
  if (item.type === "calendar") return <CalendarDaysIcon className="size-3 text-[#525252]" />;
  if (item.type === "refund") return <WalletCardsIcon className="size-3 text-[#525252]" />;
  return <MailIcon className="size-3 text-[#525252]" />;
}

function ActionSummary({ item }: { item: WorkItemWithAction }) {
  const vm = actionContentViewModel(item);

  if (vm.mode === "calendar") {
    return (
      <span className="flex items-center gap-2 font-mono text-xs text-[#a3a3a3]">
        <CalendarDaysIcon className="size-3 shrink-0 text-[#a3e635]" />
        <span className="text-[#f0f0f0]">{vm.day}</span>
        <span className="text-[#525252]">{vm.time}</span>
      </span>
    );
  }

  if (vm.mode === "refund") {
    return (
      <span className="flex items-center gap-2 font-mono text-xs text-[#a3a3a3]">
        <WalletCardsIcon className="size-3 shrink-0 text-[#a3e635]" />
        <span className="text-[#525252]">Refund</span>
        <span className="text-[#f0f0f0]">${vm.amount}</span>
        <span className="text-[#525252]">to</span>
        <span className="text-[#f0f0f0]">{vm.customerName}</span>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2 font-mono text-xs text-[#a3a3a3]">
      <MailIcon className="size-3 shrink-0 text-[#a3e635]" />
      <span className="truncate text-[#525252]">{vm.preview}</span>
    </span>
  );
}

export function ActionCard({ item, onApprove, onDismiss }: ActionCardProps) {
  const form = useForm({
    defaultValues: {
      draftBody: item.proposedAction.kind === "gmail.createDraft" ? item.proposedAction.body : "",
      calendarTitle: item.proposedAction.kind === "google-calendar.createEvent" ? item.proposedAction.title : "",
      refundReason: item.proposedAction.kind === "billing.queueRefund" ? item.proposedAction.reason : "",
    },
    onSubmit: async () => {},
  });

  const payloadOverride = (() => {
    if (item.proposedAction.kind === "gmail.createDraft") {
      return { ...item.proposedAction, body: form.state.values.draftBody };
    }
    if (item.proposedAction.kind === "google-calendar.createEvent") {
      return { ...item.proposedAction, title: form.state.values.calendarTitle };
    }
    if (item.proposedAction.kind === "billing.queueRefund") {
      return { ...item.proposedAction, reason: form.state.values.refundReason };
    }
    return item.proposedAction;
  })();

  return (
    <article className="group border border-[#1a1a1a] bg-[#0d0d0d] transition-colors duration-100 hover:border-[#252525]">
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-[#a3e635]" />
          <TypeBadge item={item} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-[#a3a3a3]">
            <span className="text-[#f0f0f0]">{item.actor}</span>
            {" "}
            <span className="text-[#383838]">·</span>
            {" "}
            <span className="text-[#525252]">{item.source}</span>
            {" — "}
            {item.summary}
          </p>
        </div>
      </div>

      <div className="border-t border-[#141414] px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <ActionSummary item={item} />

            {item.proposedAction.kind === "gmail.createDraft" ? (
              <form.Field
                name="draftBody"
                children={(field) => (
                  <textarea
                    className="w-full min-h-[72px] resize-none rounded-none border border-[#1a1a1a] bg-[#080808] px-3 py-2 font-mono text-xs leading-relaxed text-[#a3a3a3] outline-none transition-colors focus:border-[#252525] focus:text-[#f0f0f0]"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
              />
            ) : null}

            {item.proposedAction.kind === "google-calendar.createEvent" ? (
              <form.Field
                name="calendarTitle"
                children={(field) => (
                  <input
                    className="w-full rounded-none border border-[#1a1a1a] bg-[#080808] px-3 py-2 font-mono text-xs text-[#a3a3a3] outline-none transition-colors focus:border-[#252525] focus:text-[#f0f0f0]"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
              />
            ) : null}

            {item.proposedAction.kind === "billing.queueRefund" ? (
              <form.Field
                name="refundReason"
                children={(field) => (
                  <input
                    className="w-full rounded-none border border-[#1a1a1a] bg-[#080808] px-3 py-2 font-mono text-xs text-[#a3a3a3] outline-none transition-colors focus:border-[#252525] focus:text-[#f0f0f0]"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
              />
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => onDismiss(item)}
              className="hidden sm:inline-flex h-7 items-center gap-1.5 border border-[#1a1a1a] px-3 font-mono text-[11px] tracking-wide text-[#525252] transition-colors hover:border-[#252525] hover:text-[#a3a3a3]"
            >
              <XIcon className="size-3" />
              {secondaryActionLabel(item)}
            </button>

            <button
              type="button"
              onClick={() => onApprove(item, payloadOverride)}
              className="h-7 inline-flex items-center gap-1.5 border border-[#a3e635]/30 bg-[#a3e635]/5 px-3 font-mono text-[11px] tracking-wide text-[#a3e635] transition-colors hover:border-[#a3e635] hover:bg-[#a3e635]/10"
            >
              {primaryActionLabel(item)}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
