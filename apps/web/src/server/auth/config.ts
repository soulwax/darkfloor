// File: apps/web/src/server/auth/config.ts

import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq, sql } from "drizzle-orm";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

import { env } from "@/env";
import { db } from "@/server/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "@/server/db/schema";
import {
  hashForLog,
  isAuthDebugEnabled,
  isOAuthVerboseDebugEnabled,
  logAuthDebug,
  logAuthError,
  logAuthInfo,
  logAuthWarn,
  summarizeUrlForLog,
} from "@starchild/auth";
import { createSpotifyProvider } from "@starchild/auth/spotifyProvider";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      userHash?: string | null;
      admin: boolean;
      firstAdmin?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    userHash?: string | null;
    admin?: boolean;
    firstAdmin?: boolean;
    banned?: boolean;
  }
}

const authDebugEnabled = isAuthDebugEnabled();
const oauthVerboseDebugEnabled = isOAuthVerboseDebugEnabled();

logAuthInfo("NextAuth config bootstrap", {
  authDebugEnabled,
  oauthVerboseDebugEnabled,
  nodeEnv: process.env.NODE_ENV,
  electronBuild: env.ELECTRON_BUILD,
  hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
  authSpotifyEnabled: env.AUTH_SPOTIFY_ENABLED,
  publicAuthSpotifyEnabled: env.NEXT_PUBLIC_AUTH_SPOTIFY_ENABLED,
});

if (env.AUTH_SPOTIFY_ENABLED && !env.NEXT_PUBLIC_AUTH_SPOTIFY_ENABLED) {
  logAuthWarn(
    "AUTH_SPOTIFY_ENABLED=true but NEXT_PUBLIC_AUTH_SPOTIFY_ENABLED=false",
    {
      impact:
        "Spotify is available on the server but can be hidden in client UI.",
    },
  );
}

if (!env.AUTH_SPOTIFY_ENABLED && env.NEXT_PUBLIC_AUTH_SPOTIFY_ENABLED) {
  logAuthWarn(
    "NEXT_PUBLIC_AUTH_SPOTIFY_ENABLED=true but AUTH_SPOTIFY_ENABLED=false",
    {
      impact:
        "Spotify may appear in fallback UI while server-side sign-in remains disabled.",
      fix:
        "Set AUTH_SPOTIFY_ENABLED=true and provide SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET.",
    },
  );
}

const spotifyProvider = createSpotifyProvider({
  enabled: env.AUTH_SPOTIFY_ENABLED,
  clientId: env.SPOTIFY_CLIENT_ID,
  clientSecret: env.SPOTIFY_CLIENT_SECRET,
});

logAuthInfo("OAuth providers configured", {
  providers: ["discord", ...(spotifyProvider ? ["spotify"] : [])],
});

export const authConfig = {
  trustHost: true,
  debug: authDebugEnabled,
  basePath: "/api/auth",
  pages: { signIn: "/signin" },
  providers: [
    DiscordProvider({
      clientId: env.AUTH_DISCORD_ID,
      clientSecret: env.AUTH_DISCORD_SECRET,
    }),
    ...(spotifyProvider ? [spotifyProvider] : []),
  ],
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  logger: {
    error(code, ...message) {
      logAuthError("NextAuth internal error", {
        authjsErrorId: code,
        message,
      });
    },
    warn(code, ...message) {
      logAuthWarn("NextAuth internal warning", {
        authjsWarningId: code,
        message,
      });
    },
    debug(code, ...message) {
      logAuthDebug("NextAuth internal debug", {
        authjsDebugId: code,
        message,
      });
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        logAuthInfo("signIn callback invoked", {
          provider: account?.provider ?? null,
          providerType: account?.type ?? null,
          providerAccountHash: hashForLog(account?.providerAccountId),
          scope: account?.scope ?? null,
          userId: user?.id ?? null,
          hasProfile: Boolean(profile),
          profileKeys: profile ? Object.keys(profile) : [],
        });

        if (
          oauthVerboseDebugEnabled &&
          (account?.provider === "spotify" || account?.provider === "discord")
        ) {
          const provider = account.provider;
          const typedAccount = account as {
            access_token?: string;
            refresh_token?: string;
            id_token?: string;
            expires_at?: number;
            scope?: string;
            token_type?: string;
            session_state?: string;
          };
          const typedProfile = profile as
            | {
                id?: string;
                sub?: string;
                username?: string;
                global_name?: string;
                email?: string;
                image_url?: string;
              }
            | undefined;

          logAuthDebug("OAuth provider payload snapshot", {
            provider,
            userId: user?.id ?? null,
            providerAccountHash: hashForLog(account?.providerAccountId),
            scope: typedAccount?.scope ?? null,
            tokenType: typedAccount?.token_type ?? null,
            accessTokenLength: typedAccount?.access_token?.length ?? 0,
            refreshTokenLength: typedAccount?.refresh_token?.length ?? 0,
            hasIdToken: Boolean(typedAccount?.id_token),
            idTokenLength: typedAccount?.id_token?.length ?? 0,
            expiresAt: typedAccount?.expires_at ?? null,
            sessionStateHash: hashForLog(typedAccount?.session_state),
            profileIdHash: hashForLog(typedProfile?.id ?? typedProfile?.sub),
            profileUsername: typedProfile?.username ?? null,
            profileGlobalName: typedProfile?.global_name ?? null,
            hasProfileEmail: Boolean(typedProfile?.email),
            profileImageUrl: summarizeUrlForLog(typedProfile?.image_url),
            profileKeys: typedProfile ? Object.keys(typedProfile) : [],
          });
        }

        if (user?.id) {
          const userId = user.id;
          try {
            const [dbUser] = await db
              .select({ banned: users.banned })
              .from(users)
              .where(eq(users.id, userId))
              .limit(1);
            if (dbUser?.banned) {
              logAuthWarn("signIn denied because user is banned", {
                userId,
                provider: account?.provider ?? null,
              });
              return "/signin?error=Banned";
            }
          } catch (error) {
            logAuthError("signIn denied because ban status check failed", {
              userId,
              provider: account?.provider ?? null,
              error,
            });
            return "/signin?error=AuthFailed";
          }
        }

        if (account?.provider === "discord" && profile && user.id) {
          try {
            logAuthDebug("Updating Discord profile from OAuth payload", {
              userId: user.id,
            });

            const updates: { image?: string; name?: string } = {};

            if (profile.image_url) {
              updates.image = profile.image_url as string;
            }

            if (profile.global_name || profile.username) {
              updates.name = (profile.global_name ?? profile.username) as string;
            }

            if (Object.keys(updates).length > 0) {
              logAuthDebug("Discord profile updates prepared", {
                userId: user.id,
                updateKeys: Object.keys(updates),
              });
              await db.update(users).set(updates).where(eq(users.id, user.id));
              logAuthDebug("Discord profile updated successfully", {
                userId: user.id,
              });
            }
          } catch (error) {
            logAuthWarn("Discord profile update failed (non-blocking)", {
              userId: user.id,
              error,
            });
          }
        }

        if (user.id && !user.admin) {
          const userId = user.id;
          if (!userId) {
            return true;
          }
          try {
            const promoted = await db.transaction(async (tx) => {
              await tx.execute(
                sql`lock table "hexmusic-stream_user" in share row exclusive mode`,
              );

              const updatedRows = await tx
                .update(users)
                .set({ admin: true, firstAdmin: true })
                .where(
                  and(
                    eq(users.id, userId),
                    sql`not exists (
                      select 1
                      from "hexmusic-stream_user"
                      where "hexmusic-stream_user"."firstAdmin" = true
                    )`,
                  ),
                )
                .returning({ id: users.id });

              return updatedRows.length > 0;
            });

            if (promoted) {
              user.admin = true;
              user.firstAdmin = true;
              logAuthInfo("First-admin promotion granted", { userId });
            }
          } catch (error) {
            logAuthError(
              "signIn denied because first-admin promotion check failed",
              {
                userId,
                error,
              },
            );
            return "/signin?error=AuthFailed";
          }
        }

        logAuthInfo("signIn callback completed", {
          provider: account?.provider ?? null,
          userId: user?.id ?? null,
          allowed: true,
        });
        return true;
      } catch (error) {
        logAuthError("signIn callback failed", {
          provider: account?.provider ?? null,
          userId: user?.id ?? null,
          error,
        });

        return "/signin?error=AuthFailed";
      }
    },
    session: ({ session, user }) => {
      const normalizedSession = {
        expires: session.expires,
        user: {
          id: String(user.id),
          name: user.name ?? null,
          email: user.email ?? null,
          image: user.image ?? null,
          userHash: user.userHash ?? null,
          admin: user.admin ?? false,
          firstAdmin: user.firstAdmin ?? false,
        },
      };

      logAuthDebug("session callback resolved", {
        userId: normalizedSession.user.id,
        expires: normalizedSession.expires,
      });

      return normalizedSession;
    },

    redirect: ({ url, baseUrl }) => {
      let resolvedUrl = baseUrl;
      let reason = "fallback-base-url";

      if (url.startsWith("/")) {
        resolvedUrl = `${baseUrl}${url}`;
        reason = "relative-url";
      } else {
        try {
          if (new URL(url).origin === baseUrl) {
            resolvedUrl = url;
            reason = "same-origin";
          }
        } catch {
          reason = "invalid-url";
        }
      }

      logAuthDebug("redirect callback evaluated", {
        reason,
        incomingUrl: summarizeUrlForLog(url),
        baseUrl: summarizeUrlForLog(baseUrl),
        resolvedUrl: summarizeUrlForLog(resolvedUrl),
      });

      return resolvedUrl;
    },
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      logAuthInfo("event.signIn", {
        userId: user?.id ?? null,
        provider: account?.provider ?? null,
        providerType: account?.type ?? null,
        providerAccountHash: hashForLog(account?.providerAccountId),
        isNewUser: Boolean(isNewUser),
        hasProfile: Boolean(profile),
      });

      if (
        oauthVerboseDebugEnabled &&
        (account?.provider === "spotify" || account?.provider === "discord")
      ) {
        logAuthDebug("event.signIn verbose provider details", {
          userId: user?.id ?? null,
          provider: account?.provider ?? null,
          accountKeys: account ? Object.keys(account) : [],
          profileKeys: profile && typeof profile === "object" ? Object.keys(profile) : [],
          hasProfileEmail:
            Boolean(
              profile &&
                typeof profile === "object" &&
                "email" in profile &&
                (profile as { email?: unknown }).email,
            ),
        });
      }
    },
    async signOut(message) {
      logAuthInfo("event.signOut", {
        hasSession: "session" in message,
        hasToken: "token" in message,
      });
    },
    async createUser({ user }) {
      logAuthInfo("event.createUser", {
        userId: user?.id ?? null,
        hasEmail: Boolean(user?.email),
      });
    },
    async updateUser({ user }) {
      logAuthDebug("event.updateUser", {
        userId: user?.id ?? null,
        hasName: Boolean(user?.name),
        hasImage: Boolean(user?.image),
      });
    },
    async linkAccount({ user, account }) {
      logAuthInfo("event.linkAccount", {
        userId: user?.id ?? null,
        provider: account.provider,
        providerType: account.type,
        providerAccountHash: hashForLog(account.providerAccountId),
      });

      if (
        oauthVerboseDebugEnabled &&
        (account.provider === "spotify" || account.provider === "discord")
      ) {
        logAuthDebug("event.linkAccount verbose provider details", {
          userId: user?.id ?? null,
          provider: account.provider,
          accountKeys: Object.keys(account),
          scope: account.scope ?? null,
          expiresAt:
            typeof account.expires_at === "number" ? account.expires_at : null,
          tokenType: account.token_type ?? null,
        });
      }
    },
    async session(message) {
      logAuthDebug("event.session", {
        hasSession: Boolean(message.session),
        hasToken: Boolean(message.token),
      });
    },
  },
} satisfies NextAuthConfig;
