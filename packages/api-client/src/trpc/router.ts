// File: packages/api-client/src/trpc/router.ts

import type { AnyRouter } from "@trpc/server";

/**
 * Registry interface used to connect this package to an application's tRPC router via
 * TypeScript's declaration merging pattern.
 *
 * ## How It Works
 *
 * By default, this interface is empty. Consumers augment it by declaring a module with
 * the same path and adding an `appRouter` property of their concrete router type.
 * The `AppRouter` type (below) then conditionally resolves to this registered type.
 *
 * ## Usage
 *
 * In your application code (typically in a `.d.ts` or `.ts` file in your app's `src/`):
 *
 * ```ts
 * import type { appRouter } from "@/server/api/root"; // Your actual router
 *
 * declare module "@starchild/api-client/trpc/router" {
 *   interface TRPCRouterRegistry {
 *     appRouter: typeof appRouter; // Register your concrete router type
 *   }
 * }
 * ```
 *
 * ## Benefits
 *
 * - **Type Safety**: Client code automatically gets full type inference for all procedures
 * - **Loose Coupling**: This package doesn't need to import your actual router implementation
 * - **Flexibility**: Different apps in the monorepo can register different routers
 *
 * ## Verification
 *
 * After augmentation, hover over `AppRouter` to verify it resolves to your router type.
 * If it shows `AnyRouter`, the module augmentation may not be working (check import paths).
 *
 * @see {@link AppRouter} - The resolved router type based on this registry
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TRPCRouterRegistry {}

/**
 * Application router type resolved from the registry.
 *
 * ## Type Resolution
 *
 * - If `TRPCRouterRegistry.appRouter` exists → resolves to that concrete router type
 * - Otherwise → falls back to `AnyRouter` (minimal type safety)
 *
 * ## Best Practice
 *
 * Always augment `TRPCRouterRegistry` in your application to get full type inference.
 * Using the fallback `AnyRouter` means you lose autocomplete and type checking for procedures.
 *
 * @example
 * ```ts
 * // After proper augmentation:
 * import { api } from "@/trpc/react";
 *
 * // This will be fully typed with your router's procedures:
 * const data = api.music.getPlaylists.useQuery();
 * //    ^? Typed based on your actual router definition
 * ```
 */
export type AppRouter = TRPCRouterRegistry extends {
  appRouter: infer TRouter extends AnyRouter;
}
  ? TRouter
  : AnyRouter;
