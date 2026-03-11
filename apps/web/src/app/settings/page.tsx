// File: apps/web/src/app/settings/page.tsx

"use client";

import { useGlobalPlayer } from "@starchild/player-react/AudioPlayerContext";
import { useLocaleSwitcher } from "@/hooks/useLocaleSwitcher";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/contexts/ToastContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import type { AppLocale } from "@/i18n/routing";
import { appSignOut } from "@/services/authSignOut";
import {
  buildSpotifyFeaturePreferenceInput,
  extractSpotifyFeatureSettingsFromPreferences,
  getSpotifyFeatureConnectionSummary,
  hasCompleteSpotifyFeatureSettings,
  hasConfiguredSpotifyFeatureSettings,
  maskSpotifyClientSecret,
  normalizeSpotifyFeatureSettings,
  spotifyFeatureSettingsStorage,
} from "@/utils/spotifyFeatureSettings";
import { api } from "@starchild/api-client/trpc/react";
import type { SettingsKey } from "@starchild/types/settings";
import type { SpotifyFeatureSettings } from "@starchild/types/spotifySettings";
import { hapticLight, hapticToggle } from "@/utils/haptics";
import { settingsStorage } from "@/utils/settingsStorage";
import { springPresets } from "@/utils/spring-animations";
import { motion } from "framer-motion";
import {
  ChevronRight,
  Disc3,
  Eye,
  Music,
  Settings,
  Sparkles,
  User,
  Volume2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: SettingsItem[];
}

interface SettingsItem {
  id: string;
  label: string;
  description?: string;
  type: "toggle" | "slider" | "select" | "link" | "button";
  value?: boolean | number | string;
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: boolean | number | string) => void;
  href?: string;
  action?: () => void;
}

function getOptionLabel(
  options: { label: string; value: string }[],
  value: string | undefined,
  fallback: string,
) {
  return options.find((option) => option.value === value)?.label ?? fallback;
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const ts = useTranslations("settingsSpotify");
  const tc = useTranslations("common");
  const { data: session } = useSession();
  const { showToast } = useToast();
  const player = useGlobalPlayer();
  const isMobile = useIsMobile();
  const { locale, options: languageOptions, setLocale } = useLocaleSwitcher();
  useTheme();

  const [localSettings, setLocalSettings] = useState(() =>
    settingsStorage.getAll(),
  );
  const legacySpotifySettingsRef = useRef<SpotifyFeatureSettings>(
    spotifyFeatureSettingsStorage.getAll(),
  );
  const [spotifySettings, setSpotifySettings] =
    useState<SpotifyFeatureSettings>(() => legacySpotifySettingsRef.current);
  const [spotifyDraft, setSpotifyDraft] = useState<SpotifyFeatureSettings>(
    () => legacySpotifySettingsRef.current,
  );

  const { data: preferences, isLoading } =
    api.music.getUserPreferences.useQuery(undefined, { enabled: !!session });

  const { data: userHash } = api.music.getCurrentUserHash.useQuery(undefined, {
    enabled: !!session,
  });

  const repeatModeOptions = [
    { label: t("repeatOff"), value: "none" },
    { label: t("repeatOne"), value: "one" },
    { label: t("repeatAll"), value: "all" },
  ];
  const equalizerPresetOptions = [
    { label: t("equalizerFlat"), value: "Flat" },
    { label: t("equalizerRock"), value: "Rock" },
    { label: t("equalizerPop"), value: "Pop" },
    { label: t("equalizerJazz"), value: "Jazz" },
    { label: t("equalizerClassical"), value: "Classical" },
    { label: t("equalizerElectronic"), value: "Electronic" },
    { label: t("equalizerHipHop"), value: "Hip-Hop" },
    { label: t("equalizerVocal"), value: "Vocal" },
    { label: t("equalizerLoFi"), value: "Lo-Fi" },
    { label: t("equalizerHighFi"), value: "High-Fi" },
    { label: t("equalizerBassBoost"), value: "Bass Boost" },
    { label: t("equalizerTrebleBoost"), value: "Treble Boost" },
    { label: t("equalizerSka"), value: "Ska" },
    { label: t("equalizerReggae"), value: "Reggae" },
    { label: t("equalizerBlues"), value: "Blues" },
    { label: t("equalizerFunk"), value: "Funk" },
    { label: t("equalizerDisco"), value: "Disco" },
    { label: t("equalizerSoul"), value: "Soul" },
    { label: t("equalizerRnB"), value: "R&B" },
    { label: t("equalizerCountry"), value: "Country" },
  ];
  const visualizerModeOptions = [
    { label: t("visualizerRandom"), value: "random" },
    { label: t("visualizerOff"), value: "off" },
    { label: t("visualizerSpecific"), value: "specific" },
  ];
  const visualizerTypeOptions = [
    { label: t("flowField"), value: "flowfield" },
    { label: t("kaleidoscope"), value: "kaleidoscope" },
  ];
  const similarityOptions = [
    { label: t("similarityStrict"), value: "strict" },
    { label: t("similarityBalanced"), value: "balanced" },
    { label: t("similarityDiverse"), value: "diverse" },
  ];

  const updatePreferences = api.music.updatePreferences.useMutation({
    onSuccess: () => {
      showToast(t("settingsSaved"), "success");
    },
    onError: () => {
      showToast(t("failedToSave"), "error");
    },
  });

  const handleToggle = (key: string, value: boolean) => {
    hapticToggle();
    if (key === "showFpsCounter") {
      settingsStorage.set("showFpsCounter", value);
      setLocalSettings((prev) => ({ ...prev, showFpsCounter: value }));
      showToast(t("visualizerDebugUpdated"), "success");
      return;
    }

    if (session) {
      updatePreferences.mutate({ [key]: value });
    } else {
      settingsStorage.set(key as SettingsKey, value);
      setLocalSettings((prev) => ({ ...prev, [key]: value }));
      showToast(t("savedLocally"), "success");
    }
  };

  const handleSlider = (key: string, value: number) => {
    hapticLight();
    if (session) {
      updatePreferences.mutate({ [key]: value });
    } else {
      settingsStorage.set(key as SettingsKey, value);
      setLocalSettings((prev) => ({ ...prev, [key]: value }));
    }
  };

  const utils = api.useUtils();
  const serverSpotifySettings = useMemo(
    () => extractSpotifyFeatureSettingsFromPreferences(preferences),
    [preferences],
  );

  const handleSelect = (key: string, value: string) => {
    hapticToggle();
    if (key === "theme") {
      const themeValue = "dark" as const;
      settingsStorage.set("theme", themeValue);
      const html = document.documentElement;
      html.classList.add("theme-dark");
      html.classList.remove("theme-light");
      if (session) {
        utils.music.getUserPreferences.setData(undefined, (prev) =>
          prev ? { ...prev, theme: themeValue } : prev,
        );
        updatePreferences.mutate({ theme: themeValue });
      } else {
        setLocalSettings((prev) => ({ ...prev, theme: themeValue }));
        showToast(t("savedLocally"), "success");
      }
      return;
    }
    if (session) {
      updatePreferences.mutate({ [key]: value });
    } else {
      settingsStorage.set(key as SettingsKey, value);
      setLocalSettings((prev) => ({ ...prev, [key]: value }));
      showToast(t("savedLocally"), "success");
    }
  };

  const effectivePreferences = session ? preferences : localSettings;

  const handleSignOut = () => {
    hapticLight();
    void appSignOut({ callbackUrl: "/" });
  };

  const spotifyDraftSummary = useMemo(
    () =>
      getSpotifyFeatureConnectionSummary({
        settings: normalizeSpotifyFeatureSettings({
          ...spotifyDraft,
          enabled: hasCompleteSpotifyFeatureSettings(spotifyDraft),
        }),
      }),
    [spotifyDraft],
  );
  const spotifyDraftDirty = useMemo(
    () => JSON.stringify(spotifyDraft) !== JSON.stringify(spotifySettings),
    [spotifyDraft, spotifySettings],
  );
  const spotifyDraftDirtyRef = useRef(false);
  const hasServerSpotifySettings = useMemo(
    () => hasConfiguredSpotifyFeatureSettings(serverSpotifySettings),
    [serverSpotifySettings],
  );
  const hasLegacySpotifySettings = useMemo(
    () => hasConfiguredSpotifyFeatureSettings(legacySpotifySettingsRef.current),
    [],
  );

  useEffect(() => {
    spotifyDraftDirtyRef.current = spotifyDraftDirty;
  }, [spotifyDraftDirty]);

  useEffect(() => {
    if (!session || preferences === undefined) {
      return;
    }

    const nextSpotifySettings = hasServerSpotifySettings
      ? serverSpotifySettings
      : extractSpotifyFeatureSettingsFromPreferences(preferences);
    const nextSpotifyDraft = hasServerSpotifySettings
      ? serverSpotifySettings
      : hasLegacySpotifySettings
        ? legacySpotifySettingsRef.current
        : nextSpotifySettings;

    setSpotifySettings(nextSpotifySettings);
    setSpotifyDraft((prev) =>
      spotifyDraftDirtyRef.current ? prev : nextSpotifyDraft,
    );

    if (hasServerSpotifySettings) {
      spotifyFeatureSettingsStorage.save(nextSpotifySettings, {
        preserveUpdatedAt: true,
      });
    }
  }, [
    hasLegacySpotifySettings,
    hasServerSpotifySettings,
    preferences,
    serverSpotifySettings,
    session,
  ]);

  const handleSpotifyDraftChange = (
    key: keyof Pick<
      SpotifyFeatureSettings,
      "clientId" | "clientSecret" | "username"
    >,
    value: string,
  ) => {
    setSpotifyDraft((prev) => {
      const nextDraft = normalizeSpotifyFeatureSettings({
        ...prev,
        [key]: value,
      });

      return {
        ...nextDraft,
        enabled: hasCompleteSpotifyFeatureSettings(nextDraft),
      };
    });
  };

  const handleSpotifySettingsSave = async () => {
    hapticLight();
    const normalizedDraft = normalizeSpotifyFeatureSettings({
      ...spotifyDraft,
      enabled: hasCompleteSpotifyFeatureSettings(spotifyDraft),
    });

    await updatePreferences.mutateAsync(
      buildSpotifyFeaturePreferenceInput(normalizedDraft),
    );

    const saved = spotifyFeatureSettingsStorage.save(normalizedDraft);
    setSpotifySettings(saved);
    setSpotifyDraft(saved);
    utils.music.getUserPreferences.setData(undefined, (prev) =>
      prev
        ? {
            ...prev,
            ...buildSpotifyFeaturePreferenceInput(saved),
            spotifySettingsUpdatedAt: saved.updatedAt
              ? new Date(saved.updatedAt)
              : null,
          }
        : prev,
    );
    await utils.music.getUserPreferences.invalidate();
  };

  if (!session) {
    return (
      <div className="container mx-auto flex min-h-screen flex-col items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springPresets.gentle}
          className="text-center"
        >
          <Settings className="mx-auto mb-4 h-16 w-16 text-[var(--color-muted)]" />
          <h1 className="mb-2 text-2xl font-bold text-[var(--color-text)]">
            {t("signInRequired")}
          </h1>
          <p className="mb-6 text-[var(--color-subtext)]">
            {t("signInDescription")}
          </p>
          <Link
            href="/signin?callbackUrl=%2Fsettings"
            className="touch-target-lg inline-block rounded-xl bg-[var(--color-accent)] px-6 py-3 font-semibold text-[var(--color-on-accent)] transition hover:opacity-90"
          >
            {tc("signIn")}
          </Link>
        </motion.div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto flex min-h-screen flex-col px-4 py-8">
        <div className="mb-6 h-8 w-48 animate-pulse rounded bg-[var(--color-muted)]/20" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl bg-[var(--color-muted)]/10"
            />
          ))}
        </div>
      </div>
    );
  }

  const playbackSection: SettingsSection = {
    id: "playback",
    title: t("playback"),
    icon: <Music className="h-5 w-5" />,
    items: [
      ...(isMobile
        ? []
        : [
            {
              id: "volume",
              label: t("volume"),
              description: `${Math.round((player.volume ?? 0.7) * 100)}%`,
              type: "slider" as const,
              value: player.volume ?? 0.7,
              min: 0,
              max: 1,
              step: 0.01,
              onChange: (value: boolean | number | string) => {
                const vol = value as number;
                player.setVolume(vol);
                // Volume is persisted by the player itself, no need for preferences mutation
              },
            },
          ]),
      {
        id: "repeatMode",
        label: t("repeat"),
        description: getOptionLabel(
          repeatModeOptions,
          player.repeatMode ?? "none",
          t("repeatOff"),
        ),
        type: "select",
        value: player.repeatMode ?? "none",
        options: repeatModeOptions,
        onChange: (value) => {
          const mode = value as "none" | "one" | "all";
          const modeOrder: ("none" | "one" | "all")[] = ["none", "all", "one"];
          const currentMode = player.repeatMode;
          const targetIndex = modeOrder.indexOf(mode);
          const currentIndex = modeOrder.indexOf(currentMode);

          const cyclesNeeded = (targetIndex - currentIndex + 3) % 3;
          for (let i = 0; i < cyclesNeeded; i++) {
            player.cycleRepeatMode();
          }
          handleSelect("repeatMode", mode);
        },
      },
      {
        id: "shuffleEnabled",
        label: t("shuffleLabel"),
        type: "toggle",
        value: player.isShuffled ?? false,
        onChange: (value) => {
          const enabled = value as boolean;
          if (enabled !== player.isShuffled) {
            player.toggleShuffle();
          }
          handleToggle("shuffleEnabled", enabled);
        },
      },
      {
        id: "keepPlaybackAlive",
        label: t("backgroundPlayback"),
        description: t("backgroundPlaybackDesc"),
        type: "toggle",
        value: effectivePreferences?.keepPlaybackAlive ?? true,
        onChange: (value) =>
          handleToggle("keepPlaybackAlive", value as boolean),
      },
    ],
  };

  const audioSection: SettingsSection = {
    id: "audio",
    title: t("audio"),
    icon: <Volume2 className="h-5 w-5" />,
    items: [
      {
        id: "equalizerEnabled",
        label: t("equalizer"),
        description: t("equalizerDesc"),
        type: "toggle",
        value: effectivePreferences?.equalizerEnabled ?? false,
        onChange: (value) => handleToggle("equalizerEnabled", value as boolean),
      },
      {
        id: "equalizerPreset",
        label: t("equalizerPreset"),
        description: getOptionLabel(
          equalizerPresetOptions,
          effectivePreferences?.equalizerPreset,
          effectivePreferences?.equalizerPreset ?? t("equalizerFlat"),
        ),
        type: "select",
        value: effectivePreferences?.equalizerPreset ?? "Flat",
        options: equalizerPresetOptions,
        onChange: (value) => handleSelect("equalizerPreset", value as string),
      },
    ],
  };

  const visualSection: SettingsSection = {
    id: "visual",
    title: t("visual"),
    icon: <Eye className="h-5 w-5" />,
    items: [
      {
        id: "theme",
        label: t("theme"),
        description: t("themeDark"),
        type: "select",
        value: "dark",
        options: [{ label: t("themeDark"), value: "dark" }],
        onChange: (value) => handleSelect("theme", value as string),
      },
      {
        id: "language",
        label: tc("language"),
        description: t("languageDescription"),
        type: "select",
        value: locale,
        options: languageOptions,
        onChange: (value) => setLocale(value as AppLocale),
      },
      {
        id: "visualizerMode",
        label: t("visualizer"),
        description: getOptionLabel(
          visualizerModeOptions,
          effectivePreferences?.visualizerMode ?? "random",
          t("visualizerRandom"),
        ),
        type: "select",
        value: effectivePreferences?.visualizerMode ?? "random",
        options: visualizerModeOptions,
        onChange: (value) => handleSelect("visualizerMode", value as string),
      },
      ...(effectivePreferences?.visualizerMode === "specific"
        ? [
            {
              id: "visualizerType",
              label: t("visualizerType"),
              description: getOptionLabel(
                visualizerTypeOptions,
                effectivePreferences?.visualizerType ?? "flowfield",
                effectivePreferences?.visualizerType ?? t("flowField"),
              ),
              type: "select" as const,
              value: effectivePreferences?.visualizerType ?? "flowfield",
              options: visualizerTypeOptions,
              onChange: (value: boolean | number | string) =>
                handleSelect("visualizerType", value as string),
            },
          ]
        : []),
      {
        id: "showFpsCounter",
        label: t("showFpsCounter"),
        description: t("showFpsCounterDesc"),
        type: "toggle",
        value: localSettings.showFpsCounter ?? false,
        onChange: (value) => handleToggle("showFpsCounter", value as boolean),
      },
      {
        id: "compactMode",
        label: t("compactMode"),
        description: t("compactModeDesc"),
        type: "toggle",
        value: effectivePreferences?.compactMode ?? false,
        onChange: (value) => handleToggle("compactMode", value as boolean),
      },
    ],
  };

  const smartQueueSection: SettingsSection = {
    id: "smart-queue",
    title: t("smartQueue"),
    icon: <Sparkles className="h-5 w-5" />,
    items: [
      {
        id: "autoQueueEnabled",
        label: t("autoQueue"),
        description: t("autoQueueDesc"),
        type: "toggle",
        value: effectivePreferences?.autoQueueEnabled ?? false,
        onChange: (value) => handleToggle("autoQueueEnabled", value as boolean),
      },
      {
        id: "autoQueueThreshold",
        label: t("queueThreshold"),
        description: t("queueThresholdDesc", {
          count: effectivePreferences?.autoQueueThreshold ?? 3,
        }),
        type: "slider",
        value: effectivePreferences?.autoQueueThreshold ?? 3,
        min: 1,
        max: 10,
        step: 1,
        onChange: (value) =>
          handleSlider("autoQueueThreshold", value as number),
      },
      {
        id: "autoQueueCount",
        label: t("tracksToAdd"),
        description: t("tracksToAddDesc", {
          count: effectivePreferences?.autoQueueCount ?? 5,
        }),
        type: "slider",
        value: effectivePreferences?.autoQueueCount ?? 5,
        min: 1,
        max: 20,
        step: 1,
        onChange: (value) => handleSlider("autoQueueCount", value as number),
      },
      {
        id: "smartMixEnabled",
        label: t("smartMix"),
        description: t("smartMixDesc"),
        type: "toggle",
        value: effectivePreferences?.smartMixEnabled ?? true,
        onChange: (value) => handleToggle("smartMixEnabled", value as boolean),
      },
      {
        id: "similarityPreference",
        label: t("similarity"),
        description: getOptionLabel(
          similarityOptions,
          effectivePreferences?.similarityPreference ?? "balanced",
          t("similarityBalanced"),
        ),
        type: "select",
        value: effectivePreferences?.similarityPreference ?? "balanced",
        options: similarityOptions,
        onChange: (value) =>
          handleSelect("similarityPreference", value as string),
      },
    ],
  };

  const accountSection: SettingsSection = {
    id: "account",
    title: t("account"),
    icon: <User className="h-5 w-5" />,
    items: [
      {
        id: "profile",
        label: t("profileLink"),
        description: t("profileDesc"),
        type: "link",
        href: userHash ? `/${userHash}` : "/profile",
      },
      {
        id: "signOut",
        label: t("signOutLabel"),
        type: "button",
        action: handleSignOut,
      },
    ],
  };

  const sections: SettingsSection[] = [
    playbackSection,
    ...(isMobile ? [] : [audioSection]),
    visualSection,
    smartQueueSection,
  ];

  return (
    <div className="container mx-auto flex min-h-screen flex-col px-4 py-8 md:px-6 md:py-10">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springPresets.gentle}
        className="mb-8 md:mb-10"
      >
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)] md:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-subtext)]">
          {t("subtitle")}
        </p>
      </motion.div>

      <div className="space-y-6 pb-8 md:space-y-8">
        {sections.map((section, sectionIndex) => (
          <motion.div
            key={section.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              ...springPresets.gentle,
              delay: sectionIndex * 0.04,
            }}
          >
            <div className="mb-4 flex items-center gap-2.5">
              <div className="text-[var(--color-accent)]">{section.icon}</div>
              <h2 className="text-base font-semibold tracking-wide text-[var(--color-subtext)] uppercase">
                {section.title}
              </h2>
            </div>

            <div className="overflow-visible rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg backdrop-blur-sm">
              {section.items.map((item, itemIndex) => (
                <SettingsItemComponent
                  key={item.id}
                  item={item}
                  index={itemIndex}
                  isLast={itemIndex === section.items.length - 1}
                />
              ))}
            </div>
          </motion.div>
        ))}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            ...springPresets.gentle,
            delay: sections.length * 0.04,
          }}
        >
          <div className="mb-4 flex items-center gap-2.5">
            <div className="text-[#1DB954]">
              <Disc3 className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold tracking-wide text-[var(--color-subtext)] uppercase">
              {ts("sectionTitle")}
            </h2>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-lg backdrop-blur-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[15px] font-medium text-[var(--color-text)]">
                  {ts("featureProfile")}
                </p>
                <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--color-subtext)]">
                  {ts("profileDescription")}
                </p>
              </div>
              <div
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  spotifyDraftSummary.state === "ready"
                    ? "border-[rgba(29,185,84,0.35)] bg-[rgba(29,185,84,0.14)] text-[#1DB954]"
                    : spotifyDraftSummary.state === "incomplete"
                      ? "border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.12)] text-amber-300"
                      : "border-[var(--color-border)] bg-[var(--color-surface-hover)] text-[var(--color-subtext)]"
                }`}
              >
                {spotifyDraftSummary.state === "ready"
                  ? tc("ready")
                  : spotifyDraftSummary.state === "incomplete"
                    ? tc("incomplete")
                    : tc("inactive")}
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {!hasServerSpotifySettings && hasLegacySpotifySettings ? (
                <div className="rounded-2xl border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.12)] p-4 md:col-span-2">
                  <p className="text-sm font-semibold text-amber-200">
                    {ts("localValuesDetected")}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-100/90">
                    {ts("localValuesHint")}
                  </p>
                </div>
              ) : null}

              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/40 p-4">
                <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                  {ts("accountActivation")}
                </p>
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  {spotifySettings.enabled
                    ? ts("activeForAccount")
                    : ts("waitingForProfile")}
                </p>
                <p className="mt-2 text-xs text-[var(--color-subtext)]">
                  {ts("activationHint")}
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/40 p-4">
                <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                  {ts("savedSecret")}
                </p>
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  {spotifySettings.clientSecret.trim().length > 0
                    ? maskSpotifyClientSecret(spotifySettings.clientSecret)
                    : ts("notSavedYet")}
                </p>
                <p className="mt-2 text-xs text-[var(--color-subtext)]">
                  {spotifySettings.updatedAt
                    ? ts("lastSaved", {
                        date: new Date(
                          spotifySettings.updatedAt,
                        ).toLocaleString(),
                      })
                    : ts("notSavedYet")}
                </p>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                  {ts("clientId")}
                </span>
                <input
                  type="text"
                  value={spotifyDraft.clientId}
                  onChange={(event) =>
                    handleSpotifyDraftChange("clientId", event.target.value)
                  }
                  placeholder={ts("clientIdPlaceholder")}
                  autoComplete="off"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/60 px-4 py-3 text-sm text-[var(--color-text)] transition outline-none focus:border-[#1DB954]"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                  {ts("username")}
                </span>
                <input
                  type="text"
                  value={spotifyDraft.username}
                  onChange={(event) =>
                    handleSpotifyDraftChange("username", event.target.value)
                  }
                  placeholder={ts("usernamePlaceholder")}
                  autoComplete="off"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/60 px-4 py-3 text-sm text-[var(--color-text)] transition outline-none focus:border-[#1DB954]"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-xs font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                  {ts("clientSecret")}
                </span>
                <input
                  type="password"
                  value={spotifyDraft.clientSecret}
                  onChange={(event) =>
                    handleSpotifyDraftChange("clientSecret", event.target.value)
                  }
                  placeholder={ts("clientSecretPlaceholder")}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/60 px-4 py-3 text-sm text-[var(--color-text)] transition outline-none focus:border-[#1DB954]"
                />
              </label>
            </div>

            <div className="mt-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)]/30 p-4">
              <p className="mb-3 text-xs font-semibold tracking-[0.14em] text-[var(--color-subtext)] uppercase">
                {ts("connectionChecklist")}
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {spotifyDraftSummary.checks.map((check) => (
                  <div
                    key={check.id}
                    className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 px-3 py-2"
                  >
                    <span className="text-sm text-[var(--color-text)]">
                      {check.id === "enabled"
                        ? ts("checkEnabled")
                        : check.id === "clientId"
                          ? ts("checkClientId")
                          : check.id === "clientSecret"
                            ? ts("checkClientSecret")
                            : ts("checkUsername")}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        check.ready
                          ? "bg-[rgba(29,185,84,0.16)] text-[#1DB954]"
                          : "bg-[var(--color-surface-hover)] text-[var(--color-subtext)]"
                      }`}
                    >
                      {check.ready ? tc("ready") : tc("missing")}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void handleSpotifySettingsSave()}
                disabled={!spotifyDraftDirty}
                className="rounded-xl bg-[#1DB954] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ts("saveSpotifySetup")}
              </button>
              <Link
                href="/spotify"
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-5 py-3 text-sm font-semibold text-[var(--color-text)] transition hover:border-[#1DB954] hover:text-[#1DB954]"
              >
                {ts("openSpotifyPage")}
              </Link>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            ...springPresets.gentle,
            delay: (sections.length + 1) * 0.04,
          }}
        >
          <div className="mb-4 flex items-center gap-2.5">
            <div className="text-[var(--color-accent)]">
              {accountSection.icon}
            </div>
            <h2 className="text-base font-semibold tracking-wide text-[var(--color-subtext)] uppercase">
              {accountSection.title}
            </h2>
          </div>

          <div className="overflow-visible rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg backdrop-blur-sm">
            {accountSection.items.map((item, itemIndex) => (
              <SettingsItemComponent
                key={item.id}
                item={item}
                index={itemIndex}
                isLast={itemIndex === accountSection.items.length - 1}
              />
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            ...springPresets.gentle,
            delay: (sections.length + 2) * 0.04,
          }}
          className="flex justify-center pt-2"
        >
          <a
            href="https://legal.bluesix.dev"
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-[var(--color-subtext)] transition hover:text-[var(--color-text)]"
          >
            {tc("legal")}
          </a>
        </motion.div>
      </div>
    </div>
  );
}

function SettingsItemComponent({
  item,
  index,
  isLast,
}: {
  item: SettingsItem;
  index: number;
  isLast: boolean;
}) {
  const [localValue, setLocalValue] = useState(item.value);

  // Sync local value with prop - intentional controlled component pattern
  /* eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: sync prop to state */
  useEffect(() => {
    setLocalValue(item.value);
  }, [item.value]);

  const handleChange = (newValue: boolean | number | string) => {
    setLocalValue(newValue);
    item.onChange?.(newValue);
  };

  const borderClass = !isLast ? "border-b border-[var(--color-border)]" : "";

  if (item.type === "toggle") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          ...springPresets.smooth,
          delay: index * 0.02,
        }}
        className={`flex items-center justify-between px-5 py-4 transition-colors active:bg-[var(--color-surface-hover)] md:hover:bg-[var(--color-surface-hover)] ${borderClass}`}
      >
        <div className="flex-1 pr-4">
          <div className="text-[15px] font-medium text-[var(--color-text)]">
            {item.label}
          </div>
          {item.description && (
            <div className="mt-0.5 text-[13px] text-[var(--color-subtext)]">
              {item.description}
            </div>
          )}
        </div>
        <ToggleSwitch
          checked={localValue as boolean}
          onChange={(checked) => handleChange(checked)}
        />
      </motion.div>
    );
  }

  if (item.type === "slider") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          ...springPresets.smooth,
          delay: index * 0.02,
        }}
        className={`px-5 py-4 ${borderClass}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[15px] font-medium text-[var(--color-text)]">
            {item.label}
          </div>
          {item.description && (
            <div className="text-[15px] font-semibold text-[var(--color-accent)]">
              {item.description}
            </div>
          )}
        </div>
        <Slider
          value={localValue as number}
          min={item.min ?? 0}
          max={item.max ?? 100}
          step={item.step ?? 1}
          onChange={(value) => handleChange(value)}
        />
      </motion.div>
    );
  }

  if (item.type === "select") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          ...springPresets.smooth,
          delay: index * 0.02,
        }}
        className={borderClass}
      >
        <SelectButton
          label={item.label}
          description={item.description}
          value={localValue as string}
          options={item.options ?? []}
          onChange={(value) => handleChange(value)}
        />
      </motion.div>
    );
  }

  if (item.type === "link") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          ...springPresets.smooth,
          delay: index * 0.02,
        }}
        className={borderClass}
      >
        <Link
          href={item.href ?? "#"}
          className="flex items-center justify-between px-5 py-4 transition-colors active:bg-[var(--color-surface-hover)] md:hover:bg-[var(--color-surface-hover)]"
        >
          <div className="flex-1">
            <div className="text-[15px] font-medium text-[var(--color-text)]">
              {item.label}
            </div>
            {item.description && (
              <div className="mt-0.5 text-[13px] text-[var(--color-subtext)]">
                {item.description}
              </div>
            )}
          </div>
          <ChevronRight className="h-5 w-5 text-[var(--color-subtext)] transition-transform md:group-hover:translate-x-0.5" />
        </Link>
      </motion.div>
    );
  }

  if (item.type === "button") {
    const isSignOut = item.id === "signOut";
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          ...springPresets.smooth,
          delay: index * 0.02,
        }}
        className={borderClass}
      >
        <button
          onClick={item.action}
          className={`flex w-full items-center justify-between px-5 py-4 text-left transition-colors ${
            isSignOut
              ? "active:bg-red-500/10 md:hover:bg-red-500/5"
              : "active:bg-[var(--color-surface-hover)] md:hover:bg-[var(--color-surface-hover)]"
          }`}
        >
          <div
            className={`text-[15px] font-medium ${isSignOut ? "text-red-400" : "text-[var(--color-text)]"}`}
          >
            {item.label}
          </div>
          <ChevronRight
            className={`h-5 w-5 ${isSignOut ? "text-red-400/50" : "text-[var(--color-subtext)]"}`}
          />
        </button>
      </motion.div>
    );
  }

  return null;
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]"
      }`}
      role="switch"
      aria-checked={checked}
    >
      <motion.div
        animate={{
          x: checked ? 30 : 4,
        }}
        transition={springPresets.snappy}
        className="h-6 w-6 rounded-full bg-white shadow-md"
      />
    </button>
  );
}

function Slider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="relative">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-2 w-full appearance-none rounded-full outline-none"
        style={{
          background: `linear-gradient(to right,
            var(--color-slider-fill) 0%,
            var(--color-slider-fill) ${percentage}%,
            var(--color-slider-track) ${percentage}%,
            var(--color-slider-track) 100%)`,
        }}
      />
      <style jsx>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--color-slider-thumb);
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
          transition: transform 0.15s ease;
        }
        input[type="range"]::-webkit-slider-thumb:active {
          transform: scale(1.15);
        }
        input[type="range"]::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--color-slider-thumb);
          cursor: pointer;
          border: none;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
        }
        input[type="range"]::-moz-range-thumb:active {
          transform: scale(1.15);
        }
      `}</style>
    </div>
  );
}

function SelectButton({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description?: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);

  const currentOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const updateRect = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) {
        setDropdownRect(rect);
      }
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [isOpen]);

  const dropdownStyle = dropdownRect
    ? {
        position: "fixed" as const,
        top: dropdownRect.bottom + 8,
        left: dropdownRect.left,
        width: dropdownRect.width,
        zIndex: 70,
      }
    : undefined;

  const dropdownPortal =
    typeof document !== "undefined" && isOpen && dropdownStyle
      ? createPortal(
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={springPresets.snappy}
              className="theme-panel mt-2 overflow-hidden rounded-xl border shadow-2xl backdrop-blur-xl"
              style={dropdownStyle}
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    hapticLight();
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-left text-[14px] font-medium transition-colors ${
                    value === option.value
                      ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                      : "text-[var(--color-text)] active:bg-[var(--color-surface-hover)] md:hover:bg-[var(--color-surface-hover)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </motion.div>
          </>,
          document.body,
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => {
          hapticLight();
          setIsOpen(!isOpen);
        }}
        className="flex w-full items-center justify-between px-5 py-4 transition-colors active:bg-white/5 md:hover:bg-white/[0.03]"
      >
        <div className="flex-1 text-left">
          <div className="text-[15px] font-medium text-[var(--color-text)]">
            {label}
          </div>
          {description && (
            <div className="mt-0.5 text-[13px] text-[var(--color-subtext)]">
              {description}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-medium text-[var(--color-accent)]">
            {currentOption?.label ?? value}
          </span>
          <motion.div
            animate={{ rotate: isOpen ? 90 : 0 }}
            transition={springPresets.snappy}
          >
            <ChevronRight className="h-5 w-5 text-[var(--color-subtext)]" />
          </motion.div>
        </div>
      </button>

      {dropdownPortal}
    </div>
  );
}
