// File: apps/web/src/server/api/trpc.ts

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { auth } from "@/server/auth";
import { dataStore } from "@/server/data";
import { db } from "@/server/db";
import { env } from "@/env";

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth();

  return {
    db,
    dataStore,
    session,
    ...opts,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;

export const createTRPCRouter = t.router;

const enforceWriteGuard = t.middleware(async (opts) => {
  if (env.DB_WRITE_DISABLED && opts.type === "mutation") {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Database writes are temporarily disabled.",
    });
  }
  return opts.next();
});

const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {

    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

export const publicProcedure = t.procedure.use(enforceWriteGuard).use(timingMiddleware);

export const protectedProcedure = t.procedure
  .use(enforceWriteGuard)
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {

        session: { ...ctx.session, user: ctx.session.user },
      },
    });
  });
