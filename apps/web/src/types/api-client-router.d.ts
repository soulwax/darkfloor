// File: apps/web/src/types/api-client-router.d.ts

import type { AppRouter as WebAppRouter } from "@/server/api/root";

declare module "@starchild/api-client/trpc/router" {
  interface TRPCRouterRegistry {
    appRouter: WebAppRouter;
  }
}
