// File: apps/web/src/server/api/routers/social.ts

import { TRPCError } from "@trpc/server";
import { and, asc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import type { db as database } from "@/server/db";
import {
  friendRequests,
  friendships,
  playlistCollaborators,
  playlists,
  userBlocks,
  users,
} from "@/server/db/schema";

type FriendRequestStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "blocked";

const friendRequestStatusSchema = z.enum([
  "pending",
  "accepted",
  "declined",
  "cancelled",
  "blocked",
]);

const userSummaryColumns = {
  id: true,
  name: true,
  image: true,
  userHash: true,
} as const;

function getFriendshipPair(userId: string, otherUserId: string) {
  return userId < otherUserId
    ? { userAId: userId, userBId: otherUserId }
    : { userAId: otherUserId, userBId: userId };
}

async function hasBlockBetween(
  db: typeof database,
  userId: string,
  otherUserId: string,
) {
  const block = await db.query.userBlocks.findFirst({
    where: or(
      and(
        eq(userBlocks.blockerUserId, userId),
        eq(userBlocks.blockedUserId, otherUserId),
      ),
      and(
        eq(userBlocks.blockerUserId, otherUserId),
        eq(userBlocks.blockedUserId, userId),
      ),
    ),
  });

  return Boolean(block);
}

async function areFriends(
  db: typeof database,
  userId: string,
  otherUserId: string,
) {
  const pair = getFriendshipPair(userId, otherUserId);
  const friendship = await db.query.friendships.findFirst({
    where: and(
      eq(friendships.userAId, pair.userAId),
      eq(friendships.userBId, pair.userBId),
    ),
  });

  return Boolean(friendship);
}

export const socialRouter = createTRPCRouter({
  searchUsers: protectedProcedure
    .input(z.object({ query: z.string().trim().min(2).max(80) }))
    .query(async ({ ctx, input }) => {
      const query = input.query.trim();

      return ctx.db.query.users.findMany({
        where: and(
          ne(users.id, ctx.session.user.id),
          or(eq(users.userHash, query), ilike(users.name, `%${query}%`)),
        ),
        columns: userSummaryColumns,
        orderBy: [asc(users.name)],
        limit: 12,
      });
    }),

  listFriends: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const rows = await ctx.db.query.friendships.findMany({
      where: or(
        eq(friendships.userAId, userId),
        eq(friendships.userBId, userId),
      ),
      orderBy: [asc(friendships.createdAt)],
      with: {
        userA: { columns: userSummaryColumns },
        userB: { columns: userSummaryColumns },
      },
    });

    return rows.map((friendship) => ({
      id: friendship.id,
      createdAt: friendship.createdAt,
      friend:
        friendship.userAId === userId ? friendship.userB : friendship.userA,
    }));
  }),

  listFriendRequests: protectedProcedure
    .input(
      z
        .object({
          status: friendRequestStatusSchema.default("pending"),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const status = input?.status ?? "pending";
      const userId = ctx.session.user.id;

      return ctx.db.query.friendRequests.findMany({
        where: and(
          or(
            eq(friendRequests.requesterUserId, userId),
            eq(friendRequests.recipientUserId, userId),
          ),
          eq(friendRequests.status, status),
        ),
        orderBy: [asc(friendRequests.createdAt)],
        with: {
          requester: { columns: userSummaryColumns },
          recipient: { columns: userSummaryColumns },
        },
      });
    }),

  sendFriendRequest: protectedProcedure
    .input(
      z.object({
        recipientUserId: z.string().min(1),
        message: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const requesterUserId = ctx.session.user.id;
      const recipientUserId = input.recipientUserId;

      if (recipientUserId === requesterUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot send a friend request to yourself.",
        });
      }

      const recipient = await ctx.db.query.users.findFirst({
        where: eq(users.id, recipientUserId),
        columns: { id: true },
      });

      if (!recipient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found.",
        });
      }

      if (await hasBlockBetween(ctx.db, requesterUserId, recipientUserId)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Friend requests are not available for this user.",
        });
      }

      if (await areFriends(ctx.db, requesterUserId, recipientUserId)) {
        return { success: true, alreadyFriends: true };
      }

      const reciprocalRequest = await ctx.db.query.friendRequests.findFirst({
        where: and(
          eq(friendRequests.requesterUserId, recipientUserId),
          eq(friendRequests.recipientUserId, requesterUserId),
          eq(friendRequests.status, "pending"),
        ),
      });

      if (reciprocalRequest) {
        return { success: true, reciprocalPending: true };
      }

      const [request] = await ctx.db
        .insert(friendRequests)
        .values({
          requesterUserId,
          recipientUserId,
          message: input.message?.trim() ?? null,
        })
        .onConflictDoNothing({
          target: [
            friendRequests.requesterUserId,
            friendRequests.recipientUserId,
          ],
          where: sql`${friendRequests.status} = 'pending'`,
        })
        .returning();

      return { success: true, request: request ?? null };
    }),

  respondToFriendRequest: protectedProcedure
    .input(
      z.object({
        requestId: z.number(),
        status: z.enum(["accepted", "declined"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.query.friendRequests.findFirst({
        where: and(
          eq(friendRequests.id, input.requestId),
          eq(friendRequests.recipientUserId, ctx.session.user.id),
          eq(friendRequests.status, "pending"),
        ),
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Friend request not found.",
        });
      }

      if (
        await hasBlockBetween(
          ctx.db,
          request.requesterUserId,
          request.recipientUserId,
        )
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Friend requests are not available for this user.",
        });
      }

      const pair = getFriendshipPair(
        request.requesterUserId,
        request.recipientUserId,
      );

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(friendRequests)
          .set({
            status: input.status satisfies FriendRequestStatus,
            respondedAt: new Date(),
          })
          .where(eq(friendRequests.id, request.id));

        if (input.status === "accepted") {
          await tx
            .insert(friendships)
            .values({
              ...pair,
              createdByUserId: ctx.session.user.id,
            })
            .onConflictDoNothing({
              target: [friendships.userAId, friendships.userBId],
            });
        }
      });

      return { success: true };
    }),

  cancelFriendRequest: protectedProcedure
    .input(z.object({ requestId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(friendRequests)
        .set({ status: "cancelled", respondedAt: new Date() })
        .where(
          and(
            eq(friendRequests.id, input.requestId),
            eq(friendRequests.requesterUserId, ctx.session.user.id),
            eq(friendRequests.status, "pending"),
          ),
        )
        .returning({ id: friendRequests.id });

      return { success: Boolean(updated) };
    }),

  removeFriend: protectedProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const pair = getFriendshipPair(ctx.session.user.id, input.userId);
      await ctx.db
        .delete(friendships)
        .where(
          and(
            eq(friendships.userAId, pair.userAId),
            eq(friendships.userBId, pair.userBId),
          ),
        );

      return { success: true };
    }),

  blockUser: protectedProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const blockerUserId = ctx.session.user.id;
      const blockedUserId = input.userId;

      if (blockerUserId === blockedUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot block yourself.",
        });
      }

      const pair = getFriendshipPair(blockerUserId, blockedUserId);

      await ctx.db.transaction(async (tx) => {
        await tx
          .insert(userBlocks)
          .values({ blockerUserId, blockedUserId })
          .onConflictDoNothing({
            target: [userBlocks.blockerUserId, userBlocks.blockedUserId],
          });

        await tx
          .delete(friendships)
          .where(
            and(
              eq(friendships.userAId, pair.userAId),
              eq(friendships.userBId, pair.userBId),
            ),
          );

        await tx
          .update(friendRequests)
          .set({ status: "blocked", respondedAt: new Date() })
          .where(
            and(
              or(
                and(
                  eq(friendRequests.requesterUserId, blockerUserId),
                  eq(friendRequests.recipientUserId, blockedUserId),
                ),
                and(
                  eq(friendRequests.requesterUserId, blockedUserId),
                  eq(friendRequests.recipientUserId, blockerUserId),
                ),
              ),
              eq(friendRequests.status, "pending"),
            ),
          );
      });

      return { success: true };
    }),

  unblockUser: protectedProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(userBlocks)
        .where(
          and(
            eq(userBlocks.blockerUserId, ctx.session.user.id),
            eq(userBlocks.blockedUserId, input.userId),
          ),
        );

      return { success: true };
    }),

  listPlaylistCollaborators: protectedProcedure
    .input(z.object({ playlistId: z.number() }))
    .query(async ({ ctx, input }) => {
      const playlist = await ctx.db.query.playlists.findFirst({
        where: eq(playlists.id, input.playlistId),
      });

      if (!playlist) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found.",
        });
      }

      const canRead =
        playlist.userId === ctx.session.user.id ||
        Boolean(
          await ctx.db.query.playlistCollaborators.findFirst({
            where: and(
              eq(playlistCollaborators.playlistId, input.playlistId),
              eq(playlistCollaborators.userId, ctx.session.user.id),
              eq(playlistCollaborators.status, "active"),
            ),
          }),
        );

      if (!canRead) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.query.playlistCollaborators.findMany({
        where: eq(playlistCollaborators.playlistId, input.playlistId),
        orderBy: [asc(playlistCollaborators.createdAt)],
        with: {
          user: { columns: userSummaryColumns },
          invitedBy: { columns: userSummaryColumns },
        },
      });
    }),

  listMyPlaylistCollaboratorInvites: protectedProcedure.query(
    async ({ ctx }) => {
      return ctx.db.query.playlistCollaborators.findMany({
        where: and(
          eq(playlistCollaborators.userId, ctx.session.user.id),
          eq(playlistCollaborators.status, "invited"),
        ),
        orderBy: [asc(playlistCollaborators.createdAt)],
        with: {
          playlist: {
            columns: {
              id: true,
              name: true,
              description: true,
              coverImage: true,
              userId: true,
              createdAt: true,
            },
            with: {
              user: { columns: userSummaryColumns },
            },
          },
          invitedBy: { columns: userSummaryColumns },
        },
      });
    },
  ),

  invitePlaylistCollaborator: protectedProcedure
    .input(
      z.object({
        playlistId: z.number(),
        userId: z.string().min(1),
        role: z.enum(["editor", "viewer"]).default("editor"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const playlist = await ctx.db.query.playlists.findFirst({
        where: and(
          eq(playlists.id, input.playlistId),
          eq(playlists.userId, ctx.session.user.id),
        ),
      });

      if (!playlist) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found.",
        });
      }

      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Playlist owners are collaborators by default.",
        });
      }

      if (await hasBlockBetween(ctx.db, ctx.session.user.id, input.userId)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This user cannot be invited.",
        });
      }

      if (!(await areFriends(ctx.db, ctx.session.user.id, input.userId))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Collaborator invites are limited to friends.",
        });
      }

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(playlists)
          .set({
            isCollaborative: true,
            collaborationMode: "owner_invite_only",
            collaborationUpdatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(playlists.id, input.playlistId));

        await tx
          .insert(playlistCollaborators)
          .values({
            playlistId: input.playlistId,
            userId: input.userId,
            role: input.role,
            status: "invited",
            invitedByUserId: ctx.session.user.id,
          })
          .onConflictDoUpdate({
            target: [
              playlistCollaborators.playlistId,
              playlistCollaborators.userId,
            ],
            set: {
              role: input.role,
              status: "invited",
              invitedByUserId: ctx.session.user.id,
              updatedAt: new Date(),
              acceptedAt: null,
            },
          });
      });

      return { success: true };
    }),

  respondToPlaylistCollaboratorInvite: protectedProcedure
    .input(
      z.object({
        playlistId: z.number(),
        status: z.enum(["active", "left"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const collaborator = await ctx.db.query.playlistCollaborators.findFirst({
        where: and(
          eq(playlistCollaborators.playlistId, input.playlistId),
          eq(playlistCollaborators.userId, ctx.session.user.id),
          eq(playlistCollaborators.status, "invited"),
        ),
        with: {
          playlist: true,
        },
      });

      if (!collaborator) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Collaborator invite not found.",
        });
      }

      if (
        await hasBlockBetween(
          ctx.db,
          collaborator.playlist.userId,
          ctx.session.user.id,
        )
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This playlist invite is no longer available.",
        });
      }

      await ctx.db
        .update(playlistCollaborators)
        .set({
          status: input.status,
          acceptedAt: input.status === "active" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(playlistCollaborators.id, collaborator.id));

      return { success: true };
    }),

  leavePlaylistCollaborator: protectedProcedure
    .input(z.object({ playlistId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(playlistCollaborators)
        .set({ status: "left", updatedAt: new Date() })
        .where(
          and(
            eq(playlistCollaborators.playlistId, input.playlistId),
            eq(playlistCollaborators.userId, ctx.session.user.id),
            eq(playlistCollaborators.status, "active"),
          ),
        )
        .returning({ id: playlistCollaborators.id });

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Active collaborator membership not found.",
        });
      }

      return { success: true };
    }),

  removePlaylistCollaborator: protectedProcedure
    .input(
      z.object({
        playlistId: z.number(),
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const playlist = await ctx.db.query.playlists.findFirst({
        where: and(
          eq(playlists.id, input.playlistId),
          eq(playlists.userId, ctx.session.user.id),
        ),
      });

      if (!playlist) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Playlist not found.",
        });
      }

      await ctx.db
        .update(playlistCollaborators)
        .set({ status: "removed", updatedAt: new Date() })
        .where(
          and(
            eq(playlistCollaborators.playlistId, input.playlistId),
            eq(playlistCollaborators.userId, input.userId),
          ),
        );

      return { success: true };
    }),
});
