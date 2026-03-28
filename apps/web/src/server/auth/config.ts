// File: apps/web/src/server/auth/config.ts

import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq, sql } from "drizzle-orm";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import GitHubProvider from "next-auth/providers/github";

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
const configuredProviders = ["discord"];
const oauthProviders: NonNullable<NextAuthConfig["providers"]> = [
  DiscordProvider({
    clientId: env.AUTH_DISCORD_ID,
    clientSecret: env.AUTH_DISCORD_SECRET,
    profile(rawProfile) {
      const profile = rawProfile as {
        id: string;
        username?: string;
        global_name?: string | null;
        email?: string | null;
        avatar?: string | null;
        discriminator?: string;
      };

      const displayName =
        profile.global_name ?? profile.username ?? "Discord User";
      const fallbackEmail = `discord-${profile.id}@users.darkfloor.invalid`;

      let image: string | null = null;
      if (profile.avatar === null) {
        const defaultAvatarNumber =
          profile.discriminator === "0"
            ? Number(BigInt(profile.id) >> BigInt(22)) % 6
            : parseInt(profile.discriminator ?? "0", 10) % 5;
        image = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
      } else if (
        typeof profile.avatar === "string" &&
        profile.avatar.length > 0
      ) {
        const format = profile.avatar.startsWith("a_") ? "gif" : "png";
        image = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${format}`;
      }

      if (!profile.email) {
        logAuthWarn(
          "Discord OAuth profile missing email; using fallback email",
          {
            profileIdHash: hashForLog(profile.id),
            username: profile.username ?? null,
          },
        );
      }

      return {
        id: profile.id,
        name: displayName,
        email: profile.email ?? fallbackEmail,
        image,
      };
    },
  }),
];

if (env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET) {
  configuredProviders.push("github");
  oauthProviders.push(
    GitHubProvider({
      clientId: env.AUTH_GITHUB_ID,
      clientSecret: env.AUTH_GITHUB_SECRET,
      profile(rawProfile) {
        const profile = rawProfile as {
          id: number | string;
          login?: string;
          name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
        };

        const profileId = String(profile.id);
        const trimmedName = profile.name?.trim();
        const displayName =
          trimmedName && trimmedName.length > 0
            ? trimmedName
            : (profile.login ?? "GitHub User");
        const fallbackEmail = `github-${profileId}@users.darkfloor.invalid`;

        if (!profile.email) {
          logAuthWarn("GitHub OAuth profile missing email; using fallback email", {
            profileIdHash: hashForLog(profileId),
            username: profile.login ?? null,
          });
        }

        return {
          id: profileId,
          name: displayName,
          email: profile.email ?? fallbackEmail,
          image: profile.avatar_url ?? null,
        };
      },
    }),
  );
} else if (env.AUTH_GITHUB_ID || env.AUTH_GITHUB_SECRET) {
  logAuthWarn("GitHub provider disabled because credentials are incomplete", {
    hasClientId: Boolean(env.AUTH_GITHUB_ID),
    hasClientSecret: Boolean(env.AUTH_GITHUB_SECRET),
  });
}

logAuthInfo("NextAuth config bootstrap", {
  authDebugEnabled,
  oauthVerboseDebugEnabled,
  nodeEnv: process.env.NODE_ENV,
  electronBuild: env.ELECTRON_BUILD,
  hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
  authSpotifyEnabled: env.AUTH_SPOTIFY_ENABLED,
  publicAuthSpotifyEnabled: env.NEXT_PUBLIC_AUTH_SPOTIFY_ENABLED,
  spotifyOAuthOwner: "disabled",
});

if (env.AUTH_SPOTIFY_ENABLED || env.NEXT_PUBLIC_AUTH_SPOTIFY_ENABLED) {
  logAuthWarn("Spotify OAuth sign-in is disabled in the web runtime", {
    impact:
      "Spotify features should be configured from Settings instead of Auth.js. Web OAuth sign-in is handled by the configured NextAuth providers.",
  });
}

logAuthInfo("OAuth providers configured", {
  providers: configuredProviders,
  backendManagedProviders: [],
});

export const authConfig = {
  trustHost: true,
  debug: authDebugEnabled,
  basePath: "/api/auth",
  pages: { signIn: "/signin" },
  providers: oauthProviders,
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

        if (oauthVerboseDebugEnabled && account?.provider === "discord") {
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
              updates.name = (profile.global_name ??
                profile.username) as string;
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

      if (oauthVerboseDebugEnabled && account?.provider === "discord") {
        logAuthDebug("event.signIn verbose provider details", {
          userId: user?.id ?? null,
          provider: account?.provider ?? null,
          accountKeys: account ? Object.keys(account) : [],
          profileKeys:
            profile && typeof profile === "object" ? Object.keys(profile) : [],
          hasProfileEmail: Boolean(
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

      if (oauthVerboseDebugEnabled && account.provider === "discord") {
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
