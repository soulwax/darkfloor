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
import type { AppDataStore } from "@/server/data";

type CallerContext = Parameters<typeof musicRouter.createCaller>[0];

type MockPreferenceRecord = Record<string, unknown> | null;

type MockDb = {
  query: {
    userPreferences: {
      findFirst: () => Promise<MockPreferenceRecord>;
    };
  };
  insert: () => { values: (values: Record<string, unknown>) => Promise<void> };
  insertValues: (values: Record<string, unknown>) => Promise<void>;
  update: () => { set: (values: Record<string, unknown>) => { where: () => Promise<void> } };
  updateSet: (values: Record<string, unknown>) => { where: () => Promise<void> };
  updateWhere: () => Promise<void>;
};

const createMockDb = (findFirstResult: MockPreferenceRecord = null): MockDb => {
  const findFirst = vi
    .fn<() => Promise<MockPreferenceRecord>>()
    .mockResolvedValue(findFirstResult);
  const insertValues = vi
    .fn<(values: Record<string, unknown>) => Promise<void>>()
    .mockResolvedValue(undefined);
  const updateWhere = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const updateSet = vi.fn<(values: Record<string, unknown>) => { where: () => Promise<void> }>().mockReturnValue({
    where: updateWhere,
  });
  const insert = vi.fn<() => { values: (values: Record<string, unknown>) => Promise<void> }>().mockReturnValue({
    values: insertValues,
  });
  const update = vi.fn<() => { set: (values: Record<string, unknown>) => { where: () => Promise<void> } }>().mockReturnValue({
    set: updateSet,
  });
  return {
    query: {
      userPreferences: {
        findFirst,
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
    dataStore: {
      kind: "mock",
      playlists: {} as AppDataStore["playlists"],
      userPreferences: {
        getByUserId: vi
          .fn()
          .mockImplementation(async () => {
            const result = await db.query.userPreferences.findFirst();
            return result as Record<string, unknown> | null;
          }),
        getUiByUserId: vi
          .fn()
          .mockImplementation(async () => {
            const result = await db.query.userPreferences.findFirst();
            return result as Record<string, unknown> | null;
          }),
        getOrCreateUiByUserId: vi
          .fn()
          .mockImplementation(async () => {
            const result = await db.query.userPreferences.findFirst();
            return result as Record<string, unknown> | null;
          }),
        upsert: vi.fn().mockImplementation(
          async (_userId: string, values: Record<string, unknown>) => {
          const existing = (await db.query.userPreferences.findFirst()) as
            | Record<string, unknown>
            | null;
          if (existing) {
            db.updateSet(values);
            await db.updateWhere();
            return;
          }

          await db.insertValues({
            userId: "user-1",
            ...values,
          });
          },
        ),
        reset: vi.fn().mockResolvedValue(undefined),
        getQueueState: vi.fn().mockResolvedValue(null),
        setQueueState: vi.fn().mockResolvedValue(undefined),
        clearQueueState: vi.fn().mockResolvedValue(undefined),
        getEqualizerByUserId: vi.fn().mockResolvedValue(null),
        upsertEqualizerByUserId: vi.fn().mockResolvedValue({
          enabled: false,
          preset: "Flat",
          bands: [],
        }),
      },
    } as AppDataStore,
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
    expect(db.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        visualizerType: "flowfield",
        keepPlaybackAlive: false,
      }),
    );
  });

  it("persists visualizer mode preferences", async () => {
    const db = createMockDb(null);

    const context = createCallerContext(db);

    const caller = musicRouter.createCaller(context);

    const result = await caller.updatePreferences({
      visualizerMode: "specific",
    });

    expect(result).toEqual({ success: true });
    expect(db.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        visualizerMode: "specific",
      }),
    );
  });

  it("persists stream quality preferences for signed-in users", async () => {
    const db = createMockDb(null);

    const context = createCallerContext(db);

    const caller = musicRouter.createCaller(context);

    const result = await caller.updatePreferences({
      streamQuality: "flac",
    });

    expect(result).toEqual({ success: true });
    expect(db.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        streamQuality: "flac",
      }),
    );
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
        spotifySettingsUpdatedAt: expect.any(Date) as unknown as Date,
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
        spotifySettingsUpdatedAt: expect.any(Date) as unknown as Date,
      }),
    );
  });

  it("sanitizes spotify secrets in user preferences responses", async () => {
    const db = createMockDb({
      id: 1,
      userId: "user-1",
      volume: 0.5,
      repeatMode: "none",
      shuffleEnabled: false,
      keepPlaybackAlive: false,
      streamQuality: "256",
      equalizerEnabled: false,
      equalizerPreset: "Flat",
      equalizerBands: [],
      equalizerPanelOpen: false,
      queuePanelOpen: false,
      visualizerType: "flowfield",
      visualizerEnabled: true,
      visualizerMode: "random",
      compactMode: false,
      theme: "dark",
      language: "en",
      spotifyFeaturesEnabled: true,
      spotifyClientId: "client-id",
      spotifyClientSecret: "client-secret",
      spotifyUsername: "spotify-user",
      spotifySettingsUpdatedAt: new Date("2026-03-14T00:00:00.000Z"),
      autoQueueEnabled: false,
      autoQueueThreshold: 3,
      autoQueueCount: 5,
      smartMixEnabled: true,
      similarityPreference: "balanced",
      createdAt: new Date("2026-03-14T00:00:00.000Z"),
      updatedAt: new Date("2026-03-14T00:00:00.000Z"),
    });

    const context = createCallerContext(db);
    const caller = musicRouter.createCaller(context);

    const result = await caller.getUserPreferences();

    expect(result.spotifyClientSecret).toBe("");
    expect(result.spotifyClientSecretConfigured).toBe(true);
  });
});
