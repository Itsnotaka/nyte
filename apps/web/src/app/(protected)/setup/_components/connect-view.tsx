"use client";

type ConnectViewProps = {
  appInstallUrl: string;
};

export function ConnectView({ appInstallUrl }: ConnectViewProps) {
  return (
    <section className="flex h-full items-center justify-center">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
            Connect GitHub
          </h1>
          <p className="max-w-sm text-sm text-[var(--color-text-muted)]">
            Install the Nyte GitHub App on your account to get started. This
            gives Nyte read access to your repositories.
          </p>
        </div>

        <a
          href={appInstallUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-primary text-primary-foreground hover:bg-primary/80 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-all"
        >
          Install the Nyte App on GitHub
        </a>

        <p className="text-xs text-[var(--color-text-faint)]">
          After installing, return here to continue setup.
        </p>
      </div>
    </section>
  );
}
