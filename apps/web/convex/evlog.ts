import { initLogger } from "evlog";

declare global {
  // Avoid re-initializing evlog when modules are hot-reloaded.
  var __nyteEvlogInitialized__: boolean | undefined;
}

const environment =
  typeof process !== "undefined" && process.env.NODE_ENV
    ? process.env.NODE_ENV
    : "development";

if (!globalThis.__nyteEvlogInitialized__) {
  initLogger({
    env: {
      service: "nyte-convex",
      environment,
    },
    pretty: environment !== "production",
    stringify: true,
  });

  globalThis.__nyteEvlogInitialized__ = true;
}

export {};
