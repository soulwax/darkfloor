"use client";

import {
  extractSpotifyFeatureSettingsFromPreferences,
  getSpotifyFeatureConnectionSummary,
  hasConfiguredSpotifyFeatureSettings,
  maskSpotifyClientSecret,
  spotifyFeatureSettingsStorage,
} from "@/utils/spotifyFeatureSettings";
import { api } from "@starchild/api-client/trpc/react";
import { springPresets } from "@/utils/spring-animations";
import {
  Disc3,
  ExternalLink,
  KeyRound,
  ShieldCheck,
  User2,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";

function getStatusClasses(
  state: ReturnType<typeof getSpotifyFeatureConnectionSummary>["state"],
): string {
  switch (state) {
    case "ready":
      return "border-[rgba(29,185,84,0.35)] bg-[rgba(29,185,84,0.14)] text-[#1DB954]";
    case "unavailable":
      return "border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.12)] text-red-300";
    case "incomplete":
      return "border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.12)] text-amber-300";
    default:
      return "border-[var(--color-border)] bg-[var(--color-surface-hover)] text-[var(--color-subtext)]";
  }
}

export default function SpotifyPage() {
  const { data: session, status } = useSession();
  const { data: preferences, isLoading } =
    api.music.getUserPreferences.useQuery(undefined, { enabled: !!session });
  const legacySettings = useMemo(
    () => spotifyFeatureSettingsStorage.getAll(),
    [],
  );
  const serverSettings = useMemo(
    () => extractSpotifyFeatureSettingsFromPreferences(preferences),
    [preferences],
  );
  const settings = useMemo(
    () =>
      hasConfiguredSpotifyFeatureSettings(serverSettings)
        ? serverSettings
        : legacySettings,
    [legacySettings, serverSettings],
  );
  const isUsingLocalFallback = useMemo(
    () =>
      !hasConfiguredSpotifyFeatureSettings(serverSettings) &&
      hasConfiguredSpotifyFeatureSettings(legacySettings),
    [legacySettings, serverSettings],
  );

  useEffect(() => {
    if (!session || !hasConfiguredSpotifyFeatureSettings(serverSettings)) {
      return;
    }

    spotifyFeatureSettingsStorage.save(serverSettings, {
      preserveUpdatedAt: true,
    });
  }, [serverSettings, session]);

  const summary = useMemo(
    () =>
      getSpotifyFeatureConnectionSummary({
        settings,
      }),
    [settings],
  );

  if (status === "loading" || (session && isLoading)) {
    return (
      <div className="container mx-auto flex min-h-screen flex-col px-4 py-8 md:px-6 md:py-10">
        <div className="mb-8 h-12 w-48 animate-pulse rounded bg-[var(--color-muted)]/20" />
        <div className="h-80 animate-pulse rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/60" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container mx-auto flex min-h-screen flex-col items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springPresets.gentle}
          className="text-center"
        >
          <Disc3 className="mx-auto mb-4 h-16 w-16 text-[#1DB954]" />
          <h1 className="mb-2 text-2xl font-bold text-[var(--color-text)]">
            Sign in required
          </h1>
          <p className="mb-6 max-w-md text-[var(--color-subtext)]">
            Sign in with Discord to view your synced Spotify feature profile.
          </p>
          <Link
            href="/signin?callbackUrl=%2Fspotify"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-6 py-3 font-semibold text-[var(--color-on-accent)] transition hover:opacity-90"
          >
            Sign In
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container mx-auto flex min-h-screen flex-col px-4 py-8 md:px-6 md:py-10">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springPresets.gentle}
        className="mb-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-[var(--color-text)] md:text-4xl">
              <Disc3 className="h-8 w-8 text-[#1DB954]" />
              Spotify
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--color-subtext)]">
              This page reflects your account-level Spotify feature profile. The
              profile activates automatically when client ID, client secret, and
              username are all saved.
            </p>
          </div>
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-accent)]"
          >
            Open settings
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springPresets.gentle}
        className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/92 p-6 shadow-[var(--shadow-lg)]"
      >
        {isUsingLocalFallback ? (
          <div className="mb-6 rounded-2xl border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.12)] px-4 py-3 text-sm text-amber-200">
            Local Spotify values were found on this device, but they have not
            been synced to your account yet. Save them from Settings to make the
            profile available for this user everywhere.
          </div>
        ) : null}

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-[var(--color-subtext)] uppercase">
              Connection health
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
              {summary.label}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--color-subtext)]">
              {summary.description}
            </p>
          </div>
          <div
            className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold ${getStatusClasses(summary.state)}`}
          >
            {summary.label}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/60 p-4">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
              <ShieldCheck className="h-4 w-4 text-[#1DB954]" />
              Account activation
            </p>
            <p className="text-lg font-semibold text-[var(--color-text)]">
              {settings.enabled ? "Active" : "Inactive"}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/60 p-4">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
              <User2 className="h-4 w-4 text-[#1DB954]" />
              Username
            </p>
            <p className="text-lg font-semibold text-[var(--color-text)]">
              {settings.username || "Not saved"}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/60 p-4">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
              <KeyRound className="h-4 w-4 text-[#1DB954]" />
              Client secret
            </p>
            <p className="text-lg font-semibold text-[var(--color-text)]">
              {maskSpotifyClientSecret(settings.clientSecret)}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/40 p-4">
          <p className="mb-3 text-xs font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
            Readiness checklist
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {summary.checks.map((check) => (
              <div
                key={check.id}
                className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 px-3 py-2"
              >
                <span className="text-sm text-[var(--color-text)]">
                  {check.label}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    check.ready
                      ? "bg-[rgba(29,185,84,0.16)] text-[#1DB954]"
                      : "bg-[var(--color-surface-hover)] text-[var(--color-subtext)]"
                  }`}
                >
                  {check.ready ? "Ready" : "Missing"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
