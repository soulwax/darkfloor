import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { Track } from "@starchild/types";

import type { DatabaseClient } from "@/server/db";
import {
  playlistCollaborators,
  playlistTracks,
  playlists,
  userBlocks,
  userPreferences,
} from "@/server/db/schema";
import type { AppDataStore } from "@/server/data/appDataStore";
import type {
  EqualizerPreferences,
  PlaylistDetails,
  PlaylistSummary,
  PlaylistWithTrackStatus,
  QueueState,
  UserPreferencesInsert,
  UserPreferencesUiRecord,
} from "@/server/data/types";

type PostgresConstraintError = {
  code?: string;
  constraint?: string;
  cause?: unknown;
};

const userPreferencesUiColumns = {
  id: true,
  userId: true,
  volume: true,
  repeatMode: true,
  shuffleEnabled: true,
  keepPlaybackAlive: true,
  streamQuality: true,
  equalizerEnabled: true,
  equalizerPreset: true,
  equalizerBands: true,
  equalizerPanelOpen: true,
  queuePanelOpen: true,
  visualizerType: true,
  visualizerEnabled: true,
  visualizerMode: true,
  compactMode: true,
  theme: true,
  colorScheme: true,
  language: true,
  spotifyFeaturesEnabled: true,
  spotifyClientId: true,
  spotifyClientSecret: true,
  spotifyUsername: true,
  spotifySettingsUpdatedAt: true,
  autoQueueEnabled: true,
  autoQueueThreshold: true,
  autoQueueCount: true,
  smartMixEnabled: true,
  similarityPreference: true,
  createdAt: true,
  updatedAt: true,
} as const;

function isUniqueConstraintError(
  error: unknown,
  constraint?: string,
): error is PostgresConstraintError {
  let current: unknown = error;

  while (current && typeof current === "object") {
    const candidate = current as PostgresConstraintError;
    if (candidate.code === "23505") {
      return constraint ? candidate.constraint === constraint : true;
    }

    current = candidate.cause;
  }

  return false;
}

function getDeezerId(track: Track): number | undefined {
  const id = track.deezer_id ?? track.id;

  return typeof id === "string" ? Number.parseInt(id, 10) || undefined : id;
}

async function syncPlaylistIdSequence(database: DatabaseClient): Promise<void> {
  await database.execute(sql`
    SELECT setval(
      pg_get_serial_sequence('"hexmusic-stream_playlist"', 'id'),
      COALESCE((SELECT MAX("id") FROM "hexmusic-stream_playlist"), 0) + 1,
      false
    )
  `);
}

async function syncPlaylistTrackIdSequence(
  database: DatabaseClient,
): Promise<void> {
  await database.execute(sql`
    SELECT setval(
      pg_get_serial_sequence('"hexmusic-stream_playlist_track"', 'id'),
      COALESCE((SELECT MAX("id") FROM "hexmusic-stream_playlist_track"), 0) + 1,
      false
    )
  `);
}

function mapPlaylistTracks(
  tracks: Array<{
    id: number;
    trackData: unknown;
    position: number;
    addedAt: Date;
    addedByUserId?: string | null;
    addedBy?: {
      id: string;
      name: string | null;
      image: string | null;
      userHash: string | null;
    } | null;
  }>,
) {
  return tracks.map((track) => ({
    id: track.id,
    track: track.trackData as Track,
    position: track.position,
    addedAt: track.addedAt,
    addedByUserId: track.addedByUserId ?? null,
    addedBy: mapPlaylistOwner(track.addedBy),
  }));
}

function mapPlaylistOwner(
  user:
    | {
        id: string;
        name: string | null;
        image: string | null;
        userHash: string | null;
      }
    | null
    | undefined,
) {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    image: user.image,
    userHash: user.userHash,
  };
}

async function getEditablePlaylistIds(
  database: DatabaseClient,
  userId: string,
): Promise<number[]> {
  const collaboratorRows = await database.query.playlistCollaborators.findMany({
    where: and(
      eq(playlistCollaborators.userId, userId),
      eq(playlistCollaborators.status, "active"),
    ),
    columns: {
      playlistId: true,
    },
  });

  return collaboratorRows.map((row) => row.playlistId);
}

async function getEditablePlaylist(
  database: DatabaseClient,
  input: { userId: string; playlistId: number },
) {
  const playlist = await database.query.playlists.findFirst({
    where: eq(playlists.id, input.playlistId),
  });

  if (!playlist) return null;
  if (playlist.userId === input.userId) return playlist;

  const collaborator = await database.query.playlistCollaborators.findFirst({
    where: and(
      eq(playlistCollaborators.playlistId, input.playlistId),
      eq(playlistCollaborators.userId, input.userId),
      eq(playlistCollaborators.status, "active"),
    ),
  });

  if (collaborator) {
    const block = await database.query.userBlocks.findFirst({
      where: or(
        and(
          eq(userBlocks.blockerUserId, playlist.userId),
          eq(userBlocks.blockedUserId, input.userId),
        ),
        and(
          eq(userBlocks.blockerUserId, input.userId),
          eq(userBlocks.blockedUserId, playlist.userId),
        ),
      ),
    });

    if (block) return null;
  }

  return collaborator ? playlist : null;
}

async function getUiPreferences(
  database: DatabaseClient,
  userId: string,
): Promise<UserPreferencesUiRecord | null> {
  return (
    (await database.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, userId),
      columns: userPreferencesUiColumns,
    })) ?? null
  );
}

async function ensureUserPreferences(
  database: DatabaseClient,
  userId: string,
): Promise<void> {
  await database
    .insert(userPreferences)
    .values({ userId })
    .onConflictDoNothing({ target: userPreferences.userId });
}

export function createDrizzleAppDataStore(
  database: DatabaseClient,
): AppDataStore {
  const upsertUserPreferences = async (
    userId: string,
    values: Partial<UserPreferencesInsert>,
  ): Promise<void> => {
    const nextValues = {
      ...values,
      updatedAt: new Date(),
    } satisfies Partial<UserPreferencesInsert>;

    await database
      .insert(userPreferences)
      .values({
        userId,
        ...nextValues,
      })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: nextValues,
      });
  };

  return {
    kind: "drizzle",
    playlists: {
      async createForUser(input) {
        const insertPlaylist = () =>
          database
            .insert(playlists)
            .values({
              userId: input.userId,
              name: input.name,
              description: input.description,
              isPublic: input.isPublic,
            })
            .returning();

        try {
          const [playlist] = await insertPlaylist();
          if (!playlist) {
            throw new Error("Failed to create playlist");
          }
          return playlist;
        } catch (error) {
          if (
            !isUniqueConstraintError(error, "hexmusic-stream_playlist_pkey")
          ) {
            throw error;
          }

          await syncPlaylistIdSequence(database);
          const [playlist] = await insertPlaylist();
          if (!playlist) {
            throw new Error("Failed to create playlist");
          }
          return playlist;
        }
      },

      async updateOwnedVisibility(input) {
        const playlist = await database.query.playlists.findFirst({
          where: and(
            eq(playlists.id, input.playlistId),
            eq(playlists.userId, input.userId),
          ),
        });

        if (!playlist) {
          return false;
        }

        await database
          .update(playlists)
          .set({
            isPublic: input.isPublic,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(playlists.id, input.playlistId),
              eq(playlists.userId, input.userId),
            ),
          );

        return true;
      },

      async updateOwnedMetadata(input) {
        const playlist = await database.query.playlists.findFirst({
          where: and(
            eq(playlists.id, input.playlistId),
            eq(playlists.userId, input.userId),
          ),
        });

        if (!playlist) {
          return false;
        }

        const updateData: Partial<typeof playlists.$inferInsert> = {};

        if (input.metadata.name !== undefined) {
          updateData.name = input.metadata.name;
        }

        if (input.metadata.description !== undefined) {
          updateData.description =
            input.metadata.description.trim().length > 0
              ? input.metadata.description
              : null;
        }

        if (Object.keys(updateData).length === 0) {
          return true;
        }

        updateData.updatedAt = new Date();

        await database
          .update(playlists)
          .set(updateData)
          .where(
            and(
              eq(playlists.id, input.playlistId),
              eq(playlists.userId, input.userId),
            ),
          );

        return true;
      },

      async listOwnedByUser(userId) {
        const editablePlaylistIds = await getEditablePlaylistIds(
          database,
          userId,
        );
        const playlistsResult = await database.query.playlists.findMany({
          where:
            editablePlaylistIds.length > 0
              ? or(
                  eq(playlists.userId, userId),
                  inArray(playlists.id, editablePlaylistIds),
                )
              : eq(playlists.userId, userId),
          orderBy: [desc(playlists.createdAt)],
          with: {
            tracks: {
              orderBy: [playlistTracks.position],
              limit: 20,
              with: {
                addedBy: {
                  columns: {
                    id: true,
                    name: true,
                    image: true,
                    userHash: true,
                  },
                },
              },
            },
          },
        });

        const playlistIds = playlistsResult.map((playlist) => playlist.id);
        const counts =
          playlistIds.length > 0
            ? await database
                .select({
                  playlistId: playlistTracks.playlistId,
                  count: sql<number>`count(*)::int`,
                })
                .from(playlistTracks)
                .where(inArray(playlistTracks.playlistId, playlistIds))
                .groupBy(playlistTracks.playlistId)
            : [];

        const countByPlaylistId = new Map(
          counts.map((entry) => [entry.playlistId, entry.count]),
        );

        return playlistsResult.map(
          (playlist): PlaylistSummary => ({
            ...playlist,
            trackCount: countByPlaylistId.get(playlist.id) ?? 0,
            tracks: mapPlaylistTracks(playlist.tracks),
          }),
        );
      },

      async listOwnedByUserWithTrackStatus(input) {
        const editablePlaylistIds = await getEditablePlaylistIds(
          database,
          input.userId,
        );
        const accessiblePlaylistWhere =
          editablePlaylistIds.length > 0
            ? or(
                eq(playlists.userId, input.userId),
                inArray(playlists.id, editablePlaylistIds),
              )
            : eq(playlists.userId, input.userId);

        const playlistsResult = await database.query.playlists.findMany({
          where: input.excludePlaylistId
            ? and(
                accessiblePlaylistWhere,
                sql`${playlists.id} != ${input.excludePlaylistId}`,
              )
            : accessiblePlaylistWhere,
          orderBy: [desc(playlists.createdAt)],
          with: {
            tracks: {
              orderBy: [playlistTracks.position],
              limit: 20,
              with: {
                addedBy: {
                  columns: {
                    id: true,
                    name: true,
                    image: true,
                    userHash: true,
                  },
                },
              },
            },
          },
        });

        const statusResults = await Promise.all(
          playlistsResult.map(async (playlist) => {
            const [totalTracks, trackInPlaylist] = await Promise.all([
              database
                .select({ count: sql<number>`count(*)::int` })
                .from(playlistTracks)
                .where(eq(playlistTracks.playlistId, playlist.id)),
              database.query.playlistTracks.findFirst({
                where: and(
                  eq(playlistTracks.playlistId, playlist.id),
                  eq(playlistTracks.trackId, input.trackId),
                ),
              }),
            ]);

            return {
              ...playlist,
              trackCount: totalTracks[0]?.count ?? 0,
              hasTrack: !!trackInPlaylist,
              tracks: mapPlaylistTracks(playlist.tracks),
            } satisfies PlaylistWithTrackStatus;
          }),
        );

        return statusResults;
      },

      async getOwnedDetails(input) {
        const playlist = await database.query.playlists.findFirst({
          where: eq(playlists.id, input.playlistId),
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                image: true,
                userHash: true,
              },
            },
            tracks: {
              orderBy: [playlistTracks.position],
              with: {
                addedBy: {
                  columns: {
                    id: true,
                    name: true,
                    image: true,
                    userHash: true,
                  },
                },
              },
            },
            collaborators: {
              where: eq(playlistCollaborators.status, "active"),
            },
          },
        });

        if (!playlist) {
          return null;
        }

        const canRead =
          playlist.userId === input.userId ||
          playlist.collaborators.some(
            (collaborator) => collaborator.userId === input.userId,
          );

        if (!canRead) {
          return null;
        }

        return {
          ...playlist,
          owner: mapPlaylistOwner(playlist.user),
          tracks: mapPlaylistTracks(playlist.tracks),
        } satisfies PlaylistDetails;
      },

      async getPublicDetails(playlistId) {
        const playlist = await database.query.playlists.findFirst({
          where: and(
            eq(playlists.id, playlistId),
            eq(playlists.isPublic, true),
          ),
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                image: true,
                userHash: true,
              },
            },
            tracks: {
              orderBy: [playlistTracks.position],
              with: {
                addedBy: {
                  columns: {
                    id: true,
                    name: true,
                    image: true,
                    userHash: true,
                  },
                },
              },
            },
          },
        });

        if (!playlist) {
          return null;
        }

        return {
          ...playlist,
          owner: mapPlaylistOwner(playlist.user),
          tracks: mapPlaylistTracks(playlist.tracks),
        } satisfies PlaylistDetails;
      },

      async addTrackToOwnedPlaylist(input) {
        const playlist = await getEditablePlaylist(database, input);

        if (!playlist) {
          return { status: "playlist-not-found" };
        }

        const existing = await database.query.playlistTracks.findFirst({
          where: and(
            eq(playlistTracks.playlistId, input.playlistId),
            eq(playlistTracks.trackId, input.track.id),
          ),
        });

        if (existing) {
          return { status: "already-exists" };
        }

        const maxPositionResult = await database
          .select({ max: sql<number>`max(${playlistTracks.position})` })
          .from(playlistTracks)
          .where(eq(playlistTracks.playlistId, input.playlistId));

        const nextPosition = (maxPositionResult[0]?.max ?? -1) + 1;
        const trackEntry = {
          playlistId: input.playlistId,
          trackId: input.track.id,
          deezerId: getDeezerId(input.track),
          trackData: input.track,
          position: nextPosition,
          addedByUserId: input.userId,
          updatedByUserId: input.userId,
        };

        const insertTrack = async () =>
          database
            .insert(playlistTracks)
            .values(trackEntry)
            .onConflictDoNothing({
              target: [playlistTracks.playlistId, playlistTracks.trackId],
            })
            .returning({ id: playlistTracks.id });

        let inserted: Array<{ id: number }> = [];

        try {
          inserted = await insertTrack();
        } catch (error) {
          if (
            !isUniqueConstraintError(
              error,
              "hexmusic-stream_playlist_track_pkey",
            )
          ) {
            throw error;
          }

          await syncPlaylistTrackIdSequence(database);
          inserted = await insertTrack();
        }

        return inserted.length === 0
          ? { status: "already-exists" }
          : { status: "added" };
      },

      async removeTrackFromOwnedPlaylist(input) {
        const playlist = await getEditablePlaylist(database, input);

        if (!playlist) {
          return false;
        }

        await database
          .delete(playlistTracks)
          .where(
            and(
              eq(playlistTracks.id, input.trackEntryId),
              eq(playlistTracks.playlistId, input.playlistId),
            ),
          );

        return true;
      },

      async deleteOwnedPlaylist(input) {
        await database
          .delete(playlists)
          .where(
            and(
              eq(playlists.id, input.playlistId),
              eq(playlists.userId, input.userId),
            ),
          );
      },

      async reorderOwnedPlaylist(input) {
        const playlist = await getEditablePlaylist(database, input);

        if (!playlist) {
          return false;
        }

        for (const update of input.trackUpdates) {
          await database
            .update(playlistTracks)
            .set({
              position: update.newPosition,
              updatedByUserId: input.userId,
            })
            .where(
              and(
                eq(playlistTracks.id, update.trackEntryId),
                eq(playlistTracks.playlistId, input.playlistId),
              ),
            );
        }

        return true;
      },
    },

    userPreferences: {
      async getByUserId(userId) {
        return (
          (await database.query.userPreferences.findFirst({
            where: eq(userPreferences.userId, userId),
          })) ?? null
        );
      },

      async getUiByUserId(userId) {
        return getUiPreferences(database, userId);
      },

      async getOrCreateUiByUserId(userId) {
        await ensureUserPreferences(database, userId);
        const prefs = await getUiPreferences(database, userId);

        if (!prefs) {
          throw new Error("Failed to load user preferences");
        }

        return prefs;
      },

      async upsert(userId, values) {
        await upsertUserPreferences(userId, values);
      },

      async reset(userId) {
        await database
          .delete(userPreferences)
          .where(eq(userPreferences.userId, userId));
      },

      async getQueueState(userId) {
        const prefs = await database.query.userPreferences.findFirst({
          where: eq(userPreferences.userId, userId),
          columns: {
            queueState: true,
          },
        });

        return prefs?.queueState ?? null;
      },

      async setQueueState(userId, queueState: QueueState) {
        await upsertUserPreferences(userId, { queueState });
      },

      async clearQueueState(userId) {
        const existing = await database.query.userPreferences.findFirst({
          where: eq(userPreferences.userId, userId),
          columns: { id: true },
        });

        if (!existing) {
          return;
        }

        await database
          .update(userPreferences)
          .set({ queueState: null, updatedAt: new Date() })
          .where(eq(userPreferences.userId, userId));
      },

      async getEqualizerByUserId(userId) {
        const prefs = await database.query.userPreferences.findFirst({
          where: eq(userPreferences.userId, userId),
          columns: {
            equalizerEnabled: true,
            equalizerPreset: true,
            equalizerBands: true,
          },
        });

        if (!prefs) {
          return null;
        }

        return {
          enabled: prefs.equalizerEnabled ?? false,
          preset: prefs.equalizerPreset ?? "Flat",
          bands: prefs.equalizerBands ?? [],
        } satisfies EqualizerPreferences;
      },

      async upsertEqualizerByUserId(userId, values) {
        await upsertUserPreferences(userId, {
          ...(values.enabled !== undefined
            ? { equalizerEnabled: values.enabled }
            : {}),
          ...(values.preset !== undefined
            ? { equalizerPreset: values.preset }
            : {}),
          ...(values.bands !== undefined
            ? { equalizerBands: values.bands }
            : {}),
        });

        const prefs = await database.query.userPreferences.findFirst({
          where: eq(userPreferences.userId, userId),
          columns: {
            equalizerEnabled: true,
            equalizerPreset: true,
            equalizerBands: true,
          },
        });

        if (!prefs) {
          throw new Error("Failed to load equalizer preferences");
        }

        return {
          enabled: prefs.equalizerEnabled ?? false,
          preset: prefs.equalizerPreset ?? "Flat",
          bands: prefs.equalizerBands ?? [],
        } satisfies EqualizerPreferences;
      },
    },
  };
}
