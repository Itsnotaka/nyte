export default function App() {
  return (
    <main className="flex flex-col items-center justify-center h-svh">
      <div className="bg-surface-subtle hover:ring-bg-surface-strong ease-out-expo w-full rounded-[14px] transition-shadow duration-200 hover:ring-2">
        <div className="rounded-[14px] p-0.5 shadow-lg" tabindex="-1">
          <div className="bg-surface flex flex-col rounded-xl shadow-md">
            <div className="flex w-full items-center">
              <div className="relative flex flex-1 cursor-text transition-colors [--lh:1lh]">
                <div
                  contenteditable="true"
                  className="w-full resize-none border-0 bg-transparent outline-none text-sm text-neutral py-2 pl-3.5 pr-2 whitespace-pre-wrap focus:ring-0 min-h-[32px] caret-transparent"
                  role="textbox"
                  aria-label="Specify a workflow to handle..."
                ></div>
                <div
                  className="pointer-events-none absolute top-2 left-3.5 hidden items-center gap-1 text-sm sm:flex"
                  style="opacity: 1; transform: none;"
                >
                  <span className="inline-flex items-center gap-1 text-neutral-subtle">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="rounded-md size-4"
                    >
                      <rect width="16" height="16" fill="#533AFD"></rect>
                      <path
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M4.3 11.7L11.7 10.1307V4.3L4.3 5.88765V11.7Z"
                        fill="white"
                      ></path>
                    </svg>
                    <span>Stripe</span>
                  </span>
                  <span className="text-neutral">
                    flag invoices over $5k that are 7+ days overdue and prepare
                    an update
                  </span>
                </div>
                <div
                  className="pointer-events-none absolute top-2 left-3.5 text-sm text-neutral-subtle sm:hidden"
                  style="opacity: 1;"
                >
                  Specify a workflow to handle...
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between overflow-hidden p-2">
            <div className="flex items-center gap-1 sm:gap-2">
              <div
                tabindex="0"
                type="button"
                className="group/button focus-visible:ring-neutral-strong relative inline-flex shrink-0 cursor-pointer rounded-lg whitespace-nowrap transition-transform outline-none select-none focus-visible:ring-2 h-7 px-1.5"
                prefetch="auto"
              >
                <div className="absolute rounded-lg border transition-transform border-transparent bg-surface-strong opacity-0 group-hover/button:opacity-100 group-hover/button:blur-none group-hover/button:inset-0 inset-2 blur-sm group-active/button:inset-shadow-xs group-active/button:shadow-none"></div>
                <div className="text-sm relative z-10 flex items-center gap-1 text-neutral-subtle group-hover/button:text-neutral">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    className="lucide lucide-at-sign size-4"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="4"></circle>
                    <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"></path>
                  </svg>
                  <div className="text-sm px-0.5 leading-0 transition-transform">
                    <span className="hidden min-[400px]:inline">
                      Add context
                    </span>
                  </div>
                  <div className="flex items-center pr-1 sm:pr-2">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="rounded-md -mr-1.5 ring-2 ring-bg-surface-subtle"
                    >
                      <rect width="16" height="16" fill="#533AFD"></rect>
                      <path
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M4.3 11.7L11.7 10.1307V4.3L4.3 5.88765V11.7Z"
                        fill="white"
                      ></path>
                    </svg>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="rounded-md -mr-1.5 ring-2 ring-bg-surface-subtle"
                    >
                      <rect width="16" height="16" fill="#24292F" rx="3"></rect>
                      <path
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M8 1.33c-3.68 0-6.67 2.99-6.67 6.67 0 2.95 1.91 5.45 4.57 6.33.33.06.45-.14.45-.32v-1.24c-1.86.4-2.25-.79-2.25-.79-.3-.77-.74-.98-.74-.98-.61-.41.05-.4.05-.4.67.05 1.02.69 1.02.69.6 1.02 1.56.73 1.94.56.06-.43.23-.73.42-.89-1.48-.17-3.04-.74-3.04-3.3 0-.73.26-1.33.69-1.79-.07-.17-.3-.85.07-1.77 0 0 .56-.18 1.84.68.53-.15 1.1-.22 1.67-.22.57 0 1.14.08 1.67.22 1.28-.86 1.84-.68 1.84-.68.37.92.14 1.6.07 1.77.43.46.69 1.06.69 1.79 0 2.56-1.56 3.13-3.05 3.29.24.21.45.62.45 1.24v1.83c0 .18.12.39.46.32 2.65-.88 4.56-3.38 4.56-6.33 0-3.68-2.99-6.67-6.67-6.67z"
                        fill="white"
                      ></path>
                    </svg>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="rounded-md ring-2 ring-bg-surface-subtle"
                    >
                      <rect width="16" height="16" fill="#5E6AD2" rx="3"></rect>
                      <path
                        d="M3.01 8.524c.115 1.102.595 2.173 1.44 3.017.844.844 1.915 1.324 3.016 1.44L3.01 8.523z"
                        fill="white"
                      ></path>
                      <path
                        d="M2.99 7.717l5.283 5.283c.448-.025.894-.11 1.323-.255L3.246 6.394a5.5 5.5 0 00-.255 1.323z"
                        fill="white"
                      ></path>
                      <path
                        d="M3.473 5.834l6.683 6.683c.347-.166.678-.374.987-.625L4.098 4.847a4.5 4.5 0 00-.625.987z"
                        fill="white"
                      ></path>
                      <path
                        d="M4.473 4.435c1.957-1.934 5.112-1.926 7.06.022 1.949 1.948 1.956 5.102.023 7.06L4.472 4.436z"
                        fill="white"
                      ></path>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            <div
              tabindex="0"
              type="button"
              className="group/button focus-visible:ring-neutral-strong relative inline-flex shrink-0 cursor-pointer rounded-lg whitespace-nowrap transition-transform outline-none select-none focus-visible:ring-2 h-7 px-1.5"
              prefetch="auto"
            >
              <div className="absolute rounded-lg border transition-transform bg-gradient-to-t from-surface to-surface border-neutral shadow-xs group-hover/button:to-surface-weak inset-0 group-active/button:inset-shadow-xs group-active/button:shadow-none group-active/button:to-surface-subtle"></div>
              <div className="text-sm relative z-10 flex items-center gap-1 text-neutral">
                <div className="text-sm px-0.5 leading-0 transition-transform">
                  Go
                </div>
                <div className="border-neutral bg-surface-weak h-4 items-center rounded border px-1 text-[10px] text-neutral-subtle shadow-xs md:inline-flex hidden sm:inline-flex">
                  ↵
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
