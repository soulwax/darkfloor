// File: apps/web/src/app/settings/page.tsx

"use client";

import { useGlobalPlayer } from "@starchild/player-react/AudioPlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/contexts/ToastContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { appSignOut } from "@/services/authSignOut";
import { api } from "@starchild/api-client/trpc/react";
import type { SettingsKey } from "@starchild/types/settings";
import { hapticLight, hapticToggle } from "@/utils/haptics";
import { settingsStorage } from "@/utils/settingsStorage";
import { springPresets } from "@/utils/spring-animations";
import { motion } from "framer-motion";
import {
    ChevronRight,
    Eye,
    Music,
    Settings,
    Sparkles,
    User,
    Volume2,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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

export default function SettingsPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const player = useGlobalPlayer();
  const isMobile = useIsMobile();
  const { theme: effectiveTheme } = useTheme();

  const [localSettings, setLocalSettings] = useState(() =>
    settingsStorage.getAll(),
  );

  const { data: preferences, isLoading } =
    api.music.getUserPreferences.useQuery(undefined, { enabled: !!session });

  const { data: userHash } = api.music.getCurrentUserHash.useQuery(undefined, {
    enabled: !!session,
  });

  const updatePreferences = api.music.updatePreferences.useMutation({
    onSuccess: () => {
      showToast("Settings saved", "success");
    },
    onError: () => {
      showToast("Failed to save settings", "error");
    },
  });

  const handleToggle = (key: string, value: boolean) => {
    hapticToggle();
    if (key === "showFpsCounter") {
      settingsStorage.set("showFpsCounter", value);
      setLocalSettings((prev) => ({ ...prev, showFpsCounter: value }));
      showToast("Visualizer debug setting updated", "success");
      return;
    }

    if (session) {
      updatePreferences.mutate({ [key]: value });
    } else {
      settingsStorage.set(key as SettingsKey, value);
      setLocalSettings((prev) => ({ ...prev, [key]: value }));
      showToast("Settings saved locally", "success");
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

  const handleSelect = (key: string, value: string) => {
    hapticToggle();
    if (key === "theme") {
      const themeValue: "dark" = "dark";
      settingsStorage.set("theme", themeValue);
      const html = document.documentElement;
      html.classList.add("theme-dark");
      html.classList.remove("theme-light");
      if (session) {
        utils.music.getUserPreferences.setData(undefined, (prev) =>
          prev ? { ...prev, theme: themeValue } : prev
        );
        updatePreferences.mutate({ theme: themeValue });
      } else {
        setLocalSettings((prev) => ({ ...prev, theme: themeValue }));
        showToast("Settings saved locally", "success");
      }
      return;
    }
    if (session) {
      updatePreferences.mutate({ [key]: value });
    } else {
      settingsStorage.set(key as SettingsKey, value);
      setLocalSettings((prev) => ({ ...prev, [key]: value }));
      showToast("Settings saved locally", "success");
    }
  };

  const effectivePreferences = session ? preferences : localSettings;

  const handleSignOut = () => {
    hapticLight();
    void appSignOut({ callbackUrl: "/" });
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
            Sign in required
          </h1>
          <p className="mb-6 text-[var(--color-subtext)]">
            Please sign in to access settings
          </p>
          <Link
            href="/signin?callbackUrl=%2Fsettings"
            className="touch-target-lg inline-block rounded-xl bg-[var(--color-accent)] px-6 py-3 font-semibold text-[var(--color-on-accent)] transition hover:opacity-90"
          >
            Sign In
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
    title: "Playback",
    icon: <Music className="h-5 w-5" />,
    items: [
      ...(isMobile
        ? []
        : [
            {
              id: "volume",
              label: "Volume",
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
        label: "Repeat",
        description:
          player.repeatMode === "none"
            ? "Off"
            : player.repeatMode === "one"
              ? "One"
              : "All",
        type: "select",
        value: player.repeatMode ?? "none",
        options: [
          { label: "Off", value: "none" },
          { label: "One", value: "one" },
          { label: "All", value: "all" },
        ],
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
        label: "Shuffle",
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
        label: "Background Playback",
        description: "Keep audio playing when the app is in the background",
        type: "toggle",
        value: effectivePreferences?.keepPlaybackAlive ?? true,
        onChange: (value) =>
          handleToggle("keepPlaybackAlive", value as boolean),
      },
    ],
  };

  const audioSection: SettingsSection = {
    id: "audio",
    title: "Audio",
    icon: <Volume2 className="h-5 w-5" />,
    items: [
      {
        id: "equalizerEnabled",
        label: "Equalizer",
        description: "Enable audio equalizer",
        type: "toggle",
        value: effectivePreferences?.equalizerEnabled ?? false,
        onChange: (value) => handleToggle("equalizerEnabled", value as boolean),
      },
      {
        id: "equalizerPreset",
        label: "Equalizer Preset",
        description: effectivePreferences?.equalizerPreset ?? "Flat",
        type: "select",
        value: effectivePreferences?.equalizerPreset ?? "Flat",
        options: [
          { label: "Flat", value: "Flat" },
          { label: "Rock", value: "Rock" },
          { label: "Pop", value: "Pop" },
          { label: "Jazz", value: "Jazz" },
          { label: "Classical", value: "Classical" },
          { label: "Electronic", value: "Electronic" },
          { label: "Hip-Hop", value: "Hip-Hop" },
          { label: "Vocal", value: "Vocal" },
          { label: "Lo-Fi", value: "Lo-Fi" },
          { label: "High-Fi", value: "High-Fi" },
          { label: "Bass Boost", value: "Bass Boost" },
          { label: "Treble Boost", value: "Treble Boost" },
          { label: "Ska", value: "Ska" },
          { label: "Reggae", value: "Reggae" },
          { label: "Blues", value: "Blues" },
          { label: "Funk", value: "Funk" },
          { label: "Disco", value: "Disco" },
          { label: "Soul", value: "Soul" },
          { label: "R&B", value: "R&B" },
          { label: "Country", value: "Country" }
        ],
        onChange: (value) => handleSelect("equalizerPreset", value as string),
      },
    ],
  };

  const visualSection: SettingsSection = {
    id: "visual",
    title: "Visual",
    icon: <Eye className="h-5 w-5" />,
    items: [
      {
        id: "theme",
        label: "Theme",
        description: "Dark (forced)",
        type: "select",
        value: "dark",
        options: [{ label: "Dark", value: "dark" }],
        onChange: (value) => handleSelect("theme", value as string),
      },
      {
        id: "visualizerMode",
        label: "Visualizer",
        description:
          effectivePreferences?.visualizerMode === "off"
            ? "Off"
            : effectivePreferences?.visualizerMode === "specific"
              ? "Specific"
              : "Random",
        type: "select",
        value: effectivePreferences?.visualizerMode ?? "random",
        options: [
          { label: "Random", value: "random" },
          { label: "Off", value: "off" },
          { label: "Specific", value: "specific" },
        ],
        onChange: (value) => handleSelect("visualizerMode", value as string),
      },
      ...(effectivePreferences?.visualizerMode === "specific"
        ? [
            {
              id: "visualizerType",
              label: "Visualizer Type",
              description: effectivePreferences?.visualizerType ?? "flowfield",
              type: "select" as const,
              value: effectivePreferences?.visualizerType ?? "flowfield",
              options: [
                { label: "Flow Field", value: "flowfield" },
                { label: "Kaleidoscope", value: "kaleidoscope" },
              ],
              onChange: (value: boolean | number | string) =>
                handleSelect("visualizerType", value as string),
            },
          ]
        : []),
      {
        id: "showFpsCounter",
        label: "Show FPS Counter",
        description: "Display visualizer performance metrics",
        type: "toggle",
        value: localSettings.showFpsCounter ?? false,
        onChange: (value) => handleToggle("showFpsCounter", value as boolean),
      },
      {
        id: "compactMode",
        label: "Compact Mode",
        description: "Use compact player interface",
        type: "toggle",
        value: effectivePreferences?.compactMode ?? false,
        onChange: (value) => handleToggle("compactMode", value as boolean),
      },
    ],
  };

  const smartQueueSection: SettingsSection = {
    id: "smart-queue",
    title: "Smart Queue",
    icon: <Sparkles className="h-5 w-5" />,
    items: [
      {
        id: "autoQueueEnabled",
        label: "Auto Queue",
        description: "Automatically add similar tracks",
        type: "toggle",
        value: effectivePreferences?.autoQueueEnabled ?? false,
        onChange: (value) => handleToggle("autoQueueEnabled", value as boolean),
      },
      {
        id: "autoQueueThreshold",
        label: "Queue Threshold",
        description: `${effectivePreferences?.autoQueueThreshold ?? 3} tracks`,
        type: "slider",
        value: effectivePreferences?.autoQueueThreshold ?? 3,
        min: 1,
        max: 10,
        step: 1,
        onChange: (value) => handleSlider("autoQueueThreshold", value as number),
      },
      {
        id: "autoQueueCount",
        label: "Tracks to Add",
        description: `${effectivePreferences?.autoQueueCount ?? 5} tracks`,
        type: "slider",
        value: effectivePreferences?.autoQueueCount ?? 5,
        min: 1,
        max: 20,
        step: 1,
        onChange: (value) => handleSlider("autoQueueCount", value as number),
      },
      {
        id: "smartMixEnabled",
        label: "Smart Mix",
        description: "Generate personalized mixes",
        type: "toggle",
        value: effectivePreferences?.smartMixEnabled ?? true,
        onChange: (value) => handleToggle("smartMixEnabled", value as boolean),
      },
      {
        id: "similarityPreference",
        label: "Similarity",
        description:
          effectivePreferences?.similarityPreference === "strict"
            ? "Strict"
            : effectivePreferences?.similarityPreference === "diverse"
              ? "Diverse"
              : "Balanced",
        type: "select",
        value: effectivePreferences?.similarityPreference ?? "balanced",
        options: [
          { label: "Strict", value: "strict" },
          { label: "Balanced", value: "balanced" },
          { label: "Diverse", value: "diverse" },
        ],
        onChange: (value) =>
          handleSelect("similarityPreference", value as string),
      },
    ],
  };

  const accountSection: SettingsSection = {
    id: "account",
    title: "Account",
    icon: <User className="h-5 w-5" />,
    items: [
      {
        id: "profile",
        label: "Profile",
        description: "View your public profile",
        type: "link",
        href: userHash ? `/${userHash}` : "/profile",
      },
      {
        id: "signOut",
        label: "Sign Out",
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
    accountSection,
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
          Settings
        </h1>
        <p className="mt-2 text-sm text-[var(--color-subtext)]">
          Customize your listening experience
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
  useEffect(() => { setLocalValue(item.value); }, [item.value]);

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
    typeof document !== "undefined" && isOpen && dropdownStyle ? (
      createPortal(
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
    ) : null;

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
