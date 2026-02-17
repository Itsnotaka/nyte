import { Suspense } from "react";

import { HomePageFallback, HomePageServer } from "~/features/home";

export default function Page() {
  return (
    <Suspense fallback={<HomePageFallback />}>
      <HomePageServer />
    </Suspense>
  );
}
