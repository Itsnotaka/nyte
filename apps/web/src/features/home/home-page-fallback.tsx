export function HomePageFallback() {
  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_10%_12%,#6aa5ff_0%,transparent_30%),radial-gradient(circle_at_88%_16%,#f18bd1_0%,transparent_36%),radial-gradient(circle_at_86%_86%,#ff8359_0%,transparent_38%),radial-gradient(circle_at_16%_82%,#45c8ff_0%,transparent_36%),linear-gradient(125deg,#4f46e5_0%,#0ea5e9_40%,#f97316_100%)] px-4 py-10 md:py-14">
      <div className="mx-auto max-w-[760px] animate-pulse space-y-4 rounded-2xl border border-white/35 bg-white/80 p-6">
        <div className="h-4 w-40 rounded bg-zinc-200" />
        <div className="h-9 w-full rounded bg-zinc-200" />
        <div className="h-9 w-11/12 rounded bg-zinc-200" />
        <div className="h-9 w-2/3 rounded bg-zinc-200" />
      </div>
    </main>
  );
}
