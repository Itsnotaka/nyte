import { Spinner } from "@sachikit/ui/components/spinner";

export default function Loading() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner className="size-5 text-sachi-fg-muted" />
    </div>
  );
}
