// File: apps/web/src/app/[userhash]/page.tsx

"use client";

import Button from "@starchild/ui/Button";
import EnhancedTrackCard from "@/components/EnhancedTrackCard";
import { PlaylistArtwork } from "@/components/PlaylistArtwork";
import ProfileHeader from "@/components/ProfileHeader";
import { usePlaylistContextMenu } from "@/contexts/PlaylistContextMenuContext";
import Section from "@starchild/ui/Section";
import { useGlobalPlayer } from "@starchild/player-react/AudioPlayerContext";
import { useWebShare } from "@/hooks/useWebShare";
import { api } from "@starchild/api-client/trpc/react";
import type { Track } from "@starchild/types";
import { haptic } from "@/utils/haptics";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { use } from "react";

export default function PublicProfilePage({
  params,
}: {
  params: Promise<{ userhash: string }>;
}) {
  const { userhash } = use(params);
  const tc = useTranslations("common");
  const tp = useTranslations("profile");
  const { share, isSupported: isShareSupported } = useWebShare();
  const { openMenu: openPlaylistMenu } = usePlaylistContextMenu();
  const { playTrack, addToQueue } = useGlobalPlayer();
  const utils = api.useUtils();

  const { data: currentUserHash } = api.music.getCurrentUserHash.useQuery(
    undefined,
    { staleTime: 5 * 60 * 1000 },
  );
  const isOwnProfile = !!currentUserHash && currentUserHash === userhash;

  const { data: profile, isLoading: profileLoading } =
    api.music.getPublicProfile.useQuery(
      { userHash: userhash },
      {
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
      },
    );

  const { data: recentTracks, isLoading: tracksLoading } =
    api.music.getPublicListeningHistory.useQuery({
      userHash: userhash,
      limit: 12,
    });

  const { data: favorites, isLoading: favoritesLoading } =
    api.music.getPublicFavorites.useQuery({
      userHash: userhash,
      limit: 12,
    });

  const { data: playlists, isLoading: playlistsLoading } =
    api.music.getPublicPlaylists.useQuery({ userHash: userhash });

  const { data: topTracks, isLoading: topTracksLoading } =
    api.music.getPublicTopTracks.useQuery({
      userHash: userhash,
      limit: 6,
    });

  const { data: topArtists, isLoading: topArtistsLoading } =
    api.music.getPublicTopArtists.useQuery({
      userHash: userhash,
      limit: 6,
    });

  const removeFromHistoryByTrackId =
    api.music.removeFromHistoryByTrackId.useMutation({
      onSuccess: async () => {
        await utils.music.getPublicListeningHistory.invalidate({
          userHash: userhash,
        });
      },
    });

  const handleShareProfile = async () => {
    haptic("light");
    await share({
      title: tp("shareTitle", { name: profile?.name ?? tp("user") }),
      text: tp("shareText", { name: profile?.name ?? tp("user") }),
      url: window.location.href,
    });
  };

  if (profileLoading) {
    return (
      <div className="page-shell flex min-h-screen items-center justify-center px-6">
        <div className="surface-panel w-full max-w-sm space-y-4 p-8 text-center">
          <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-[var(--color-accent)]/35 border-t-transparent"></div>
          <p className="text-[var(--color-subtext)]">{tp("loadingProfile")}</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="page-shell flex min-h-screen items-center justify-center px-6">
        <div className="surface-panel w-full max-w-md space-y-4 p-8 text-center">
          <div className="mb-4 text-6xl">🔒</div>
          <h1 className="mb-2 text-2xl font-bold text-[var(--color-text)]">
            {tp("profileNotFound")}
          </h1>
          <p className="mb-6 text-[var(--color-subtext)]">
            {tp("profileNotFoundDescription")}
          </p>
          <Button href="/" variant="primary" ariaLabel={tc("goHome")}>
            {tc("goHome")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl">
        <ProfileHeader
          profile={profile}
          isShareSupported={isShareSupported}
          onShare={handleShareProfile}
        />

        <Section
          title={tp("recentlyPlayed")}
          loading={tracksLoading}
          items={recentTracks}
          renderItem={(item, idx) => {
            if (
              typeof item !== "object" ||
              item === null ||
              !("trackData" in item)
            ) {
              return null;
            }
            const historyItem = item as { trackData: Track; playedAt: Date };
            return (
              <EnhancedTrackCard
                key={`recent-${idx}`}
                track={historyItem.trackData}
                onPlay={(track) => playTrack(track)}
                onAddToQueue={(track) => addToQueue(track)}
                removeFromListLabel={
                  isOwnProfile ? tp("removeFromRecentlyPlayed") : undefined
                }
                onRemoveFromList={
                  isOwnProfile
                    ? () =>
                        removeFromHistoryByTrackId.mutate({
                          trackId: historyItem.trackData.id,
                        })
                    : undefined
                }
              />
            );
          }}
          gridColumns={2}
          emptyMessage={tp("noRecentTracksYet")}
        />

        <Section
          title={tp("topTracksAllTime")}
          loading={topTracksLoading}
          items={topTracks}
          renderItem={(item, idx) => {
            if (
              typeof item !== "object" ||
              item === null ||
              !("track" in item) ||
              !("playCount" in item)
            ) {
              return null;
            }
            const topTrack = item as {
              track: Track;
              playCount: number;
              totalDuration: number | null;
            };
            return (
              <div key={`top-${idx}`} className="relative">
                <EnhancedTrackCard
                  track={topTrack.track}
                  onPlay={(track) => playTrack(track)}
                  onAddToQueue={(track) => addToQueue(track)}
                />
                <div className="badge-accent absolute top-2 right-2 text-[0.65rem] leading-none">
                  {tp("plays", { count: topTrack.playCount })}
                </div>
              </div>
            );
          }}
          gridColumns={2}
          emptyMessage={tp("noTopTracksYet")}
        />

        <Section
          title={tp("topArtistsAllTime")}
          loading={topArtistsLoading}
          items={topArtists}
          renderItem={(item, idx) => {
            if (
              typeof item !== "object" ||
              item === null ||
              !("artist" in item) ||
              !("playCount" in item)
            ) {
              return null;
            }
            const topArtist = item as {
              artist: Track["artist"];
              playCount: number;
            };
            return (
              <div
                key={`artist-${idx}`}
                className="surface-panel group p-4 text-center transition-transform hover:-translate-y-1.5"
              >
                <div className="mb-3 flex h-20 w-full items-center justify-center overflow-hidden rounded-lg bg-[linear-gradient(135deg,rgba(244,178,102,0.35),rgba(88,198,177,0.35))]">
                  {topArtist.artist.picture_medium ||
                  topArtist.artist.picture ? (
                    <Image
                      src={
                        topArtist.artist.picture_medium ??
                        topArtist.artist.picture ??
                        ""
                      }
                      alt={topArtist.artist.name}
                      width={80}
                      height={80}
                      className="h-full w-full object-cover transition-transform group-hover:scale-110"
                    />
                  ) : (
                    <div className="text-4xl text-[var(--color-muted)]">🎤</div>
                  )}
                </div>
                <h3 className="mb-1 truncate font-semibold text-[var(--color-text)]">
                  {topArtist.artist.name}
                </h3>
                <p className="text-xs text-[var(--color-subtext)]">
                  {tp("plays", { count: topArtist.playCount })}
                </p>
              </div>
            );
          }}
          gridColumns={6}
          skeletonHeight="h-32"
          emptyIcon="🎤"
          emptyMessage={tp("noTopArtistsYet")}
        />

        <Section
          title={tp("favoriteTracks")}
          loading={favoritesLoading}
          items={favorites}
          renderItem={(item, idx) => {
            if (typeof item !== "object" || item === null) {
              return null;
            }
            const track = item as Track;
            return (
              <EnhancedTrackCard
                key={`fav-${idx}`}
                track={track}
                onPlay={(t) => playTrack(t)}
                onAddToQueue={(t) => addToQueue(t)}
              />
            );
          }}
          gridColumns={2}
          emptyIcon="💫"
          emptyMessage={tp("noFavoritesYet")}
        />

        <Section
          title={tp("publicPlaylists")}
          loading={playlistsLoading}
          items={playlists}
          renderItem={(item) => {
            if (
              typeof item !== "object" ||
              item === null ||
              !("id" in item) ||
              !("name" in item)
            ) {
              return null;
            }
            const playlist = item as unknown as {
              id: number;
              name: string;
              description?: string | null;
              coverImage: string | null;
              trackCount?: number;
            };
            return (
              <Link
                key={playlist.id}
                href={`/playlists/${playlist.id}`}
                onContextMenu={(event) => {
                  event.preventDefault();
                  haptic("light");
                  const path = `/playlists/${playlist.id}`;
                  openPlaylistMenu(
                    {
                      id: playlist.id,
                      name: playlist.name,
                      description: playlist.description ?? null,
                      isPublic: true,
                      coverImage: playlist.coverImage ?? null,
                      trackCount: playlist.trackCount ?? 0,
                    },
                    event.clientX,
                    event.clientY,
                    {
                      mode: "foreign",
                      openPath: path,
                      shareUrl: `${window.location.origin}${path}`,
                      resolveTracks: async () => {
                        const fullPlaylist =
                          await utils.music.getPublicPlaylist.fetch({
                            id: playlist.id,
                          });
                        return [...(fullPlaylist.tracks ?? [])]
                          .sort((a, b) => a.position - b.position)
                          .map((entry) => entry.track);
                      },
                    },
                  );
                }}
                className="surface-panel group p-4 transition-transform hover:-translate-y-1"
              >
                <PlaylistArtwork
                  name={playlist.name}
                  coverImage={playlist.coverImage}
                  className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-[linear-gradient(135deg,rgba(244,178,102,0.3),rgba(88,198,177,0.3))]"
                  imageClassName="object-cover transition-transform group-hover:scale-105"
                  iconClassName="h-12 w-12 text-[var(--color-muted)]"
                  sizes="(max-width: 768px) 100px, 125px"
                />
                <h3 className="mb-1 line-clamp-1 font-semibold text-[var(--color-text)]">
                  {playlist.name}
                </h3>
                {playlist.description && (
                  <p className="line-clamp-2 text-sm text-[var(--color-subtext)]">
                    {playlist.description}
                  </p>
                )}
              </Link>
            );
          }}
          gridColumns={4}
          skeletonCount={4}
          skeletonHeight="h-48"
          emptyIcon="📚"
          emptyMessage={tp("noPublicPlaylistsYet")}
          className="mb-0"
        />
      </div>
    </div>
  );
}
