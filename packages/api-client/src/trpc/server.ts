// File: packages/api-client/src/trpc/server.ts

import "server-only";

import { createHydrationHelpers } from "@trpc/react-query/rsc";
import type { AnyRouter } from "@trpc/server";
import { headers } from "next/headers";
import { cache } from "react";

import { type AppRouter } from "./router";
import { createQueryClient } from "./query-client";

/**
 * Options for creating tRPC server-side helpers with proper type inference.
 *
 * @template TCaller - The router caller type returned by the caller factory.
 *                     This should match the return type of your `createCallerFactory(router)(...)`
 */
interface CreateTRPCServerHelpersOptions<TCaller = unknown> {
  /**
   * Function to create the tRPC context with request headers.
   * Should match your `createTRPCContext` signature.
   */
  createContext: (options: { headers: Headers }) => unknown;

  /**
   * Function to create a router caller given a context factory.
   * Typically this is the result of `createCallerFactory(appRouter)`.
   *
   * @param createContext - Factory function that returns the tRPC context
   * @returns A typed router caller that can invoke procedures server-side
   */
  createCaller: (createContext: () => Promise<unknown>) => TCaller;
}

/**
 * Creates server-side tRPC helpers for React Server Components (RSC).
 *
 * @template TRouter - The tRPC router type (inferred or explicitly provided)
 * @template TCaller - The caller type returned by `createCaller` (inferred from options)
 *
 * @param options - Configuration with context and caller factories
 * @returns Hydration helpers including `trpc` caller and `HydrateClient` component
 *
 * @example
 * ```ts
 * import { createCaller, type AppRouter } from "@/server/api/root";
 * import { createTRPCContext } from "@/server/api/trpc";
 *
 * const helpers = createTRPCServerHelpers<AppRouter>({
 *   createContext: ({ headers }) => createTRPCContext({ headers }),
 *   createCaller: (ctx) => createCaller(ctx),
 * });
 * ```
 */
export function createTRPCServerHelpers<
  TRouter extends AnyRouter = AppRouter,
  TCaller = unknown,
>(options: CreateTRPCServerHelpersOptions<TCaller>) {
  if (typeof options.createContext !== "function") {
    console.error(
      "[api-client/trpc/server] Invalid createContext option:",
      options.createContext,
    );
    throw new TypeError("createTRPCServerHelpers: createContext must be a function");
  }

  if (typeof options.createCaller !== "function") {
    console.error(
      "[api-client/trpc/server] Invalid createCaller option:",
      options.createCaller,
    );
    throw new TypeError("createTRPCServerHelpers: createCaller must be a function");
  }

  const createContext = cache(async () => {
    const requestHeadersInstance = new Headers(await headers());
    requestHeadersInstance.set("x-trpc-source", "rsc");

    try {
      const context = await options.createContext({
        headers: requestHeadersInstance,
      });
      if (context == null) {
        console.warn(
          "[api-client/trpc/server] createContext returned null/undefined. This can cause downstream caller failures.",
        );
      }
      return context;
    } catch (error) {
      console.error(
        "[api-client/trpc/server] createContext failed while building RSC helpers:",
        error,
      );
      throw error;
    }
  });

  const getQueryClient = cache(createQueryClient);
  let caller: TCaller;
  try {
    caller = options.createCaller(createContext);
    if (caller == null) {
      console.warn(
        "[api-client/trpc/server] createCaller returned null/undefined. Verify router caller wiring.",
      );
    }
  } catch (error) {
    console.error(
      "[api-client/trpc/server] createCaller failed while building RSC helpers:",
      error,
    );
    throw error;
  }

  // Type assertion: TCaller should match the decorated router type expected by createHydrationHelpers.
  // The actual type is correctly inferred at the call site when createCaller is provided.
  return createHydrationHelpers<TRouter>(
    caller as Parameters<typeof createHydrationHelpers<TRouter>>[0],
    getQueryClient,
  );
}
