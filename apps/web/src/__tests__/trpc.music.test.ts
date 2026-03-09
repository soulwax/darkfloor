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
  insertValues: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  updateSet: ReturnType<typeof vi.fn>;
  updateWhere: ReturnType<typeof vi.fn>;
};

const createMockDb = (findFirstResult: unknown = null): MockDb => {
  const insertValues = vi.fn().mockResolvedValue(undefined);
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn().mockReturnValue({
    where: updateWhere,
  });
  const insert = vi.fn().mockReturnValue({
    values: insertValues,
  });
  const update = vi.fn().mockReturnValue({
    set: updateSet,
  });
  return {
    query: {
      userPreferences: {
        findFirst: vi.fn().mockResolvedValue(findFirstResult),
      },
    },
    insert,
    insertValues,
    update,
    updateSet,
    updateWhere,
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

  it("persists spotify feature settings per user and auto-enables complete profiles", async () => {
    const db = createMockDb(null);

    const context = createCallerContext(db);
    const caller = musicRouter.createCaller(context);

    const result = await caller.updatePreferences({
      spotifyClientId: " client-id ",
      spotifyClientSecret: " client-secret ",
      spotifyUsername: " spotify-user ",
    });

    expect(result).toEqual({ success: true });
    expect(db.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        spotifyFeaturesEnabled: true,
        spotifyClientId: "client-id",
        spotifyClientSecret: "client-secret",
        spotifyUsername: "spotify-user",
        spotifySettingsUpdatedAt: expect.any(Date),
      }),
    );
  });

  it("disables spotify features when a saved profile becomes incomplete", async () => {
    const db = createMockDb({
      userId: "user-1",
      spotifyFeaturesEnabled: true,
      spotifyClientId: "client-id",
      spotifyClientSecret: "client-secret",
      spotifyUsername: "spotify-user",
    });

    const context = createCallerContext(db);
    const caller = musicRouter.createCaller(context);

    const result = await caller.updatePreferences({
      spotifyClientSecret: "",
    });

    expect(result).toEqual({ success: true });
    expect(db.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        spotifyFeaturesEnabled: false,
        spotifyClientId: "client-id",
        spotifyClientSecret: "",
        spotifyUsername: "spotify-user",
        spotifySettingsUpdatedAt: expect.any(Date),
      }),
    );
  });
});
