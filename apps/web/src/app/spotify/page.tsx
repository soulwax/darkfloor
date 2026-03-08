"use client";

import {
  getSpotifyFeatureConnectionSummary,
  maskSpotifyClientSecret,
  spotifyFeatureSettingsStorage,
  SPOTIFY_FEATURE_SETTINGS_UPDATED_EVENT,
} from "@/utils/spotifyFeatureSettings";
import type { SpotifyFeatureSettings } from "@starchild/types/spotifySettings";
import { springPresets } from "@/utils/spring-animations";
import {
  Disc3,
  ExternalLink,
  KeyRound,
  ShieldCheck,
  User2,
} from "lucide-react";
import { getProviders } from "next-auth/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  const [settings, setSettings] = useState<SpotifyFeatureSettings>(() =>
    spotifyFeatureSettingsStorage.getAll(),
  );
  const [providerAvailable, setProviderAvailable] = useState(false);
  const [isCheckingProvider, setIsCheckingProvider] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const syncSettings = () => {
      if (cancelled) return;
      setSettings(spotifyFeatureSettingsStorage.getAll());
    };

    const handleSettingsUpdated = () => {
      syncSettings();
    };

    syncSettings();

    window.addEventListener(
      SPOTIFY_FEATURE_SETTINGS_UPDATED_EVENT,
      handleSettingsUpdated,
    );
    window.addEventListener("storage", handleSettingsUpdated);

    void getProviders()
      .then((providers) => {
        if (cancelled) return;
        setProviderAvailable(Boolean(providers?.spotify));
      })
      .catch(() => {
        if (cancelled) return;
        setProviderAvailable(false);
      })
      .finally(() => {
        if (cancelled) return;
        setIsCheckingProvider(false);
      });

    return () => {
      cancelled = true;
      window.removeEventListener(
        SPOTIFY_FEATURE_SETTINGS_UPDATED_EVENT,
        handleSettingsUpdated,
      );
      window.removeEventListener("storage", handleSettingsUpdated);
    };
  }, []);

  const summary = useMemo(
    () =>
      getSpotifyFeatureConnectionSummary({
        settings,
        providerAvailable,
      }),
    [providerAvailable, settings],
  );

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
              This page is a readiness checkpoint for Spotify features. Playlist
              flows and deeper integrations can be layered on later without
              changing the saved setup shape.
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
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-[var(--color-subtext)] uppercase">
              Connection health
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
              {isCheckingProvider
                ? "Checking Spotify provider..."
                : summary.label}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--color-subtext)]">
              {isCheckingProvider
                ? "Inspecting the current build for an active Spotify provider."
                : summary.description}
            </p>
          </div>
          <div
            className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold ${getStatusClasses(summary.state)}`}
          >
            {isCheckingProvider ? "Checking" : summary.label}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/60 p-4">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
              <ShieldCheck className="h-4 w-4 text-[#1DB954]" />
              Feature toggle
            </p>
            <p className="text-lg font-semibold text-[var(--color-text)]">
              {settings.enabled ? "Enabled" : "Disabled"}
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
