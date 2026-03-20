// File: apps/web/src/components/ProfileHeader.tsx

"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";

interface ProfileStats {
  tracksPlayed: number;
  favorites: number;
  playlists: number;
}

interface ProfileData {
  name: string | null;
  image: string | null;
  bio: string | null;
  stats: ProfileStats;
}

interface ProfileHeaderProps {
  profile: ProfileData;
  isShareSupported: boolean;
  onShare: () => void;
}

export default function ProfileHeader({
  profile,
  isShareSupported,
  onShare,
}: ProfileHeaderProps) {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const [imageError, setImageError] = useState(false);

  return (
    <div className="surface-panel relative mb-8 overflow-hidden p-8">
      <div className="bg-[radial-gradient(circle,rgba(244,178,102,0.2),transparent 60%)] pointer-events-none absolute -top-24 -left-16 h-72 w-72 rounded-full blur-3xl" />
      <div className="bg-[radial-gradient(circle,rgba(88,198,177,0.18),transparent 65%)] pointer-events-none absolute -right-24 -bottom-32 h-80 w-80 rounded-full blur-3xl" />

      <div className="relative flex flex-col items-center gap-6 md:flex-row">
        {}
        <div className="relative">
          {profile.image && !imageError ? (
            <Image
              src={profile.image}
              alt={profile.name ?? t("user")}
              width={128}
              height={128}
              className="h-32 w-32 rounded-full border-4 border-[var(--color-accent)]/55 shadow-[var(--color-accent)]/28 shadow-lg"
              onError={() => setImageError(true)}
              loading="lazy"
              quality={85}
            />
          ) : (
            <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-[var(--color-accent)]/55 bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-strong))] text-5xl font-bold text-[var(--color-on-accent)] shadow-[var(--accent-btn-shadow)]">
              {profile.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
          )}
          <div className="absolute -right-2 -bottom-2 rounded-full bg-[var(--color-success)] p-2 shadow-lg shadow-[rgba(88,198,177,0.35)]">
            <svg
              className="h-6 w-6 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-4h2v2h-2zm0-10h2v8h-2z" />
            </svg>
          </div>
        </div>

        {}
        <div className="relative flex-1 text-center md:text-left">
          <h1 className="text-glow mb-2 text-4xl font-bold text-[var(--color-text)]">
            {profile.name ?? t("anonymousUser")}
          </h1>
          {profile.bio && (
            <p className="mb-4 text-lg text-[var(--color-subtext)]">
              {profile.bio}
            </p>
          )}

          {}
          <div className="flex flex-wrap justify-center gap-6 md:justify-start">
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--color-accent)]">
                {profile.stats?.tracksPlayed ?? 0}
              </div>
              <div className="text-sm text-[var(--color-subtext)]">
                {t("tracksPlayed")}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--color-accent-strong)]">
                {profile.stats?.favorites ?? 0}
              </div>
              <div className="text-sm text-[var(--color-subtext)]">
                {t("favorites")}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--color-danger)]">
                {profile.stats?.playlists ?? 0}
              </div>
              <div className="text-sm text-[var(--color-subtext)]">
                {tc("playlists")}
              </div>
            </div>
          </div>
        </div>

        {}
        {isShareSupported && (
          <button
            onClick={onShare}
            className="touch-target flex items-center gap-2 rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-2 text-[var(--color-text)] transition-colors hover:bg-[var(--color-accent)]/20"
            aria-label={t("shareProfileAria", {
              name: profile.name ?? t("user"),
            })}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            {t("shareProfile")}
          </button>
        )}
      </div>
    </div>
  );
}
