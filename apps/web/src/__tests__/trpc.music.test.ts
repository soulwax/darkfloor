// File: apps/web/src/__tests__/trpc.music.test.ts

import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/server/db", () => ({
  db: {},
}));

vi.mock("@/services/bluesix", () => ({
  bluesix: {
    request: vi.fn(),
  },
}));

import { musicRouter } from "@/server/api/routers/music";

type CallerContext = Parameters<typeof musicRouter.createCaller>[0];

type MockDb = {
  query: {
    userPreferences: {
      findFirst: ReturnType<typeof vi.fn>;
    };
  };
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

const createMockDb = (findFirstResult: unknown = null): MockDb => {
  const insert = vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  });
  const update = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });
  return {
    query: {
      userPreferences: {
        findFirst: vi.fn().mockResolvedValue(findFirstResult),
      },
    },
    insert,
    update,
  };
};

const createCallerContext = (db: MockDb): CallerContext =>
  ({
    db: db as unknown as CallerContext extends { db: infer D } ? D : never,
    session: {
      user: { id: "user-1", admin: false },
      expires: new Date().toISOString(),
    } as unknown as CallerContext extends { session: infer S } ? S : never,
    headers: new Headers(),
  }) as CallerContext;

describe("musicRouter tRPC operations", () => {
  it("returns default smart queue settings when no preferences exist", async () => {
    const db = createMockDb(null);

    const context = createCallerContext(db);

    const caller = musicRouter.createCaller(context);

    const result = await caller.getSmartQueueSettings();

    expect(result).toEqual({
      autoQueueEnabled: false,
      autoQueueThreshold: 3,
      autoQueueCount: 5,
      smartMixEnabled: true,
      similarityPreference: "balanced",
    });
  });

  it("persists preferences with supported visualizer type", async () => {
    const db = createMockDb(null);

    const context = createCallerContext(db);

    const caller = musicRouter.createCaller(context);

    const result = await caller.updatePreferences({
      visualizerType: "flowfield",
      keepPlaybackAlive: false,
    });

    expect(result).toEqual({ success: true });
    expect(db.insert).toHaveBeenCalled();
  });
});
