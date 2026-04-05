// File: apps/web/src/app/HomePageClient.tsx

"use client";

import { PullToRefreshWrapper } from "@/components/PullToRefreshWrapper";
import { HomeFeedRow } from "@/components/HomeFeedRow";
import SwipeableTrackCard from "@/components/SwipeableTrackCard";
import { STORAGE_KEYS } from "@starchild/config/storage";
import { useGlobalPlayer } from "@starchild/player-react/AudioPlayerContext";
import { useToast } from "@/contexts/ToastContext";
import { usePlaylistContextMenu } from "@/contexts/PlaylistContextMenuContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { localStorage as appStorage } from "@/services/storage";
import { useWebShare } from "@/hooks/useWebShare";
import { api } from "@starchild/api-client/trpc/react";
import { isTrack, type Track } from "@starchild/types";
import {
  getAlbumTracks,
  getLatestReleases,
  type PlaylistFeedItem,
  getPlaylistsByGenre,
  getPlaylistsByGenreId,
  getPopularPlaylists,
  getTrackById,
  searchTracks,
  searchTracksByArtist,
} from "@starchild/api-client/rest";
import { parsePreferredGenreId } from "@/utils/genre";
import { hapticLight, hapticSuccess } from "@/utils/haptics";
import {
  springPresets,
  staggerContainer,
  staggerItem,
} from "@/utils/spring-animations";
import { AnimatePresence, motion } from "framer-motion";
import {
  Disc3,
  BookOpen,
  ListMusic,
  Music2,
  Search,
  Share2,
  Shuffle,
  Sparkles,
} from "lucide-react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ChangelogModal = dynamic(() => import("@/components/ChangelogModal"), {
  ssr: false,
});

type HomePageClientProps = {
  apiHostname?: string;
};

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function normalizeFeedTrack(track: Track): Track {
  return {
    ...track,
    deezer_id: track.deezer_id ?? track.id,
  };
}

function parseFeedPlaylistTracks(payload: unknown): Track[] {
  if (Array.isArray(payload)) {
    return payload.filter(isTrack).map(normalizeFeedTrack);
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const rows = Array.isArray(record.data)
    ? record.data
    : Array.isArray(record.tracks)
      ? record.tracks
      : [];

  return rows.filter(isTrack).map(normalizeFeedTrack);
}

function uniqueNonEmptyStrings(values: string[]): string[] {
  return Array.from(
    new Set(
      values.map((value) => value.trim()).filter((value) => value.length > 0),
    ),
  );
}

function scheduleBrowserIdleTask(
  callback: () => void,
  timeout = 1200,
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const idleWindow = window as IdleWindow;

  if (typeof idleWindow.requestIdleCallback === "function") {
    const handle = idleWindow.requestIdleCallback(() => {
      callback();
    }, { timeout });

    return () => {
      idleWindow.cancelIdleCallback?.(handle);
    };
  }

  const handle = window.setTimeout(callback, timeout);
  return () => {
    window.clearTimeout(handle);
  };
}

async function collectTracksFromQueries(
  queries: string[],
  options: {
    maxRequests: number;
    perQueryLimit: number;
    targetCount: number;
  },
): Promise<Track[]> {
  const { maxRequests, perQueryLimit, targetCount } = options;
  const collected: Track[] = [];
  const seenTrackIds = new Set<number>();

  for (const query of uniqueNonEmptyStrings(queries).slice(0, maxRequests)) {
    try {
      const response = await searchTracks(query, 0);
      for (const track of response.data.slice(0, perQueryLimit)) {
        if (seenTrackIds.has(track.id)) continue;
        seenTrackIds.add(track.id);
        collected.push(track);

        if (collected.length >= targetCount) {
          return collected;
        }
      }
    } catch {
      continue;
    }
  }

  return collected;
}

export default function HomePageClient({ apiHostname }: HomePageClientProps) {
  const { data: session } = useSession();
  const t = useTranslations("home");
  const tc = useTranslations("common");
  const tm = useTranslations("metadata");
  const { showToast } = useToast();
  const { openMenu: openPlaylistMenu } = usePlaylistContextMenu();
  const { share, isSupported: isShareSupported } = useWebShare();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const isMobile = useIsMobile();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentQuery, setCurrentQuery] = useState("");
  const [total, setTotal] = useState(0);
  const [, setIsInitialized] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isArtistSearch, setIsArtistSearch] = useState(false);
  const [apiOffset, setApiOffset] = useState(0);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [madeForYouTracks, setMadeForYouTracks] = useState<Track[]>([]);
  const [newReleaseTracks, setNewReleaseTracks] = useState<Track[]>([]);
  const [tastePlaylists, setTastePlaylists] = useState<PlaylistFeedItem[]>([]);
  const [preferredGenreId, setPreferredGenreId] = useState<number | null>(null);
  const [preferredGenreName, setPreferredGenreName] = useState("");
  const [isPageVisible, setIsPageVisible] = useState(
    () =>
      typeof document === "undefined" ||
      document.visibilityState === "visible",
  );
  const [isHomeFeedIdleReady, setIsHomeFeedIdleReady] = useState(false);
  const [isFeedSectionNearViewport, setIsFeedSectionNearViewport] =
    useState(false);
  const [isFeedCoreLoading, setIsFeedCoreLoading] = useState(false);
  const [isFeedEnrichmentLoading, setIsFeedEnrichmentLoading] =
    useState(false);
  const [hasLoadedFeedCore, setHasLoadedFeedCore] = useState(false);
  const [hasLoadedFeedEnrichment, setHasLoadedFeedEnrichment] =
    useState(false);
  const [feedReleaseQueries, setFeedReleaseQueries] = useState<string[]>([]);
  const [feedMadeForYouQueries, setFeedMadeForYouQueries] = useState<
    string[]
  >([]);
  const lastUrlQueryRef = useRef<string | null>(null);
  const lastTrackIdRef = useRef<string | null>(null);
  const shouldAutoPlayRef = useRef(false);
  const lastTasteSyncRef = useRef("");
  const feedSectionAnchorRef = useRef<HTMLDivElement | null>(null);

  const player = useGlobalPlayer();
  const hasActiveRouteQuery = [
    searchParams.get("q"),
    searchParams.get("album"),
    searchParams.get("track"),
  ].some((value) => (value ?? "").trim().length > 0);
  const homeFeedEnabled =
    mounted && !hasActiveRouteQuery && results.length === 0;
  const visibleResults = useMemo(
    () => results.filter((track) => !player.failedTrackIds.has(track.id)),
    [results, player.failedTrackIds],
  );

  useEffect(() => {
    if (!homeFeedEnabled || isHomeFeedIdleReady || !isPageVisible) return;

    const cancelIdleTask = scheduleBrowserIdleTask(() => {
      setIsHomeFeedIdleReady(true);
    }, 1500);

    return cancelIdleTask;
  }, [homeFeedEnabled, isHomeFeedIdleReady, isPageVisible]);

  useEffect(() => {
    if (!homeFeedEnabled || isFeedSectionNearViewport) return;

    const anchor = feedSectionAnchorRef.current;
    if (!anchor) return;

    if (typeof IntersectionObserver === "undefined") {
      setIsFeedSectionNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;

        setIsFeedSectionNearViewport(true);
        observer.disconnect();
      },
      {
        rootMargin: "240px 0px",
      },
    );

    observer.observe(anchor);

    return () => {
      observer.disconnect();
    };
  }, [homeFeedEnabled, isFeedSectionNearViewport]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === "visible");
    };

    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const storedGenreId = appStorage.getOrDefault<number | string | null>(
      STORAGE_KEYS.PREFERRED_GENRE_ID,
      null,
    );
    setPreferredGenreId(parsePreferredGenreId(storedGenreId));

    const storedGenreName = appStorage.getOrDefault<string>(
      STORAGE_KEYS.PREFERRED_GENRE_NAME,
      "",
    );
    setPreferredGenreName(
      typeof storedGenreName === "string" ? storedGenreName.trim() : "",
    );
  }, [mounted]);

  const addSearchQuery = api.music.addSearchQuery.useMutation();
  const { data: recentSearches } = api.music.getRecentSearches.useQuery(
    { limit: 50 },
    { enabled: !!session },
  );
  const { data: userPlaylists } = api.music.getPlaylists.useQuery(undefined, {
    enabled: !!session && !isMobile,
    refetchOnWindowFocus: false,
  });
  const { data: historyItems, isLoading: historyLoading } =
    api.music.getHistory.useQuery(
      { limit: 80, offset: 0 },
      {
        enabled: !!session && homeFeedEnabled,
        refetchOnWindowFocus: false,
      },
    );
  const { data: favoriteItems, isLoading: favoritesLoading } =
    api.music.getFavorites.useQuery(
      { limit: 40, offset: 0 },
      {
        enabled: !!session && homeFeedEnabled,
        refetchOnWindowFocus: false,
      },
    );
  const { data: tasteProfile } = api.music.getTasteProfile.useQuery(undefined, {
    enabled: !!session,
    refetchOnWindowFocus: false,
  });
  type TasteProfilePayload = {
    preferredGenreId: number | null;
    preferredGenreName: string | null;
    seedArtists: string[];
    seedPlaylistTitles: string[];
  };

  type UpsertTasteProfileMutation = {
    mutate: (
      input: TasteProfilePayload,
      options?: { onError?: (error: unknown) => void },
    ) => void;
  };

  const upsertTasteProfile = (
    api as {
      music: {
        upsertTasteProfile: {
          useMutation: () => UpsertTasteProfileMutation;
        };
      };
    }
  ).music.upsertTasteProfile.useMutation();

  useEffect(() => {
    if (!mounted || !session || !tasteProfile) return;

    const hasLocalGenre =
      preferredGenreId !== null || preferredGenreName.trim().length > 0;
    if (hasLocalGenre) return;

    const profileGenreId = parsePreferredGenreId(
      (tasteProfile.preferredGenreId as number | string | null) ?? null,
    );
    const profileGenreName = (() => {
      if (!tasteProfile || typeof tasteProfile !== "object") return "";
      if (!("preferredGenreName" in tasteProfile)) return "";
      const value = (tasteProfile as { preferredGenreName?: unknown })
        .preferredGenreName;
      return typeof value === "string" ? value.trim() : "";
    })();

    if (profileGenreId) {
      setPreferredGenreId(profileGenreId);
      appStorage.set(STORAGE_KEYS.PREFERRED_GENRE_ID, profileGenreId);
    }

    if (profileGenreName) {
      setPreferredGenreName(profileGenreName);
      appStorage.set(STORAGE_KEYS.PREFERRED_GENRE_NAME, profileGenreName);
    }
  }, [mounted, preferredGenreId, preferredGenreName, session, tasteProfile]);

  const performSearch = useCallback(
    async (searchQuery: string, force = false) => {
      if (!searchQuery.trim()) return;

      if (!force && currentQuery === searchQuery) {
        return;
      }

      setLoading(true);
      setCurrentQuery(searchQuery);
      setIsArtistSearch(false);
      setApiOffset(0);

      try {
        const response = await searchTracks(searchQuery, 0);
        setResults(response.data);
        setTotal(response.total);

        if (session) {
          addSearchQuery.mutate({ query: searchQuery });
        }

        if (shouldAutoPlayRef.current && response.data.length > 0) {
          const firstTrack = response.data[0];
          if (firstTrack) {
            console.log(
              "[HomePageClient] Auto-playing first search result:",
              firstTrack.title,
            );
            hapticSuccess();
            player.playTrack(firstTrack);
            shouldAutoPlayRef.current = false;
          }
        }
      } catch (error) {
        console.error("Search failed:", error);
        setResults([]);
        setTotal(0);
        setApiOffset(0);
        shouldAutoPlayRef.current = false;
      } finally {
        setLoading(false);
      }
    },
    [session, addSearchQuery, currentQuery, player],
  );

  const handleAlbumClick = useCallback(
    async (albumId: number) => {
      setLoading(true);
      setIsArtistSearch(false);
      setApiOffset(0);

      setResults([]);
      setTotal(0);

      try {
        const response = await getAlbumTracks(albumId);
        setResults(response.data);
        setTotal(response.total);

        const params = new URLSearchParams();
        params.set("album", albumId.toString());
        router.push(`?${params.toString()}`, { scroll: false });

        let albumName: string | undefined;
        if (response.data.length > 0) {
          const firstTrack = response.data[0];
          if (firstTrack && "album" in firstTrack && firstTrack.album) {
            albumName = firstTrack.album.title;
          }
        }

        if (!albumName) {
          try {
            const albumResponse = await fetch(`/api/album/${albumId}`);
            if (albumResponse.ok) {
              const albumData = (await albumResponse.json()) as {
                title?: string;
              };
              albumName = albumData.title;
            }
          } catch (err) {
            console.warn("Failed to fetch album info:", err);
          }
        }

        if (albumName) {
          setQuery(albumName);
          setCurrentQuery(albumName);
          if (session) {
            addSearchQuery.mutate({ query: albumName });
          }
        }
      } catch (error) {
        console.error("Album search failed:", error);
        setResults([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [session, addSearchQuery, router],
  );

  const handleSharedTrack = useCallback(
    async (trackId: number) => {
      try {
        console.log("[Shared Track] Loading track:", trackId);
        const track = await getTrackById(trackId);

        console.log("[Shared Track] Track loaded:", track.title);
        hapticSuccess();

        player.clearQueue();
        player.playTrack(track);

        setResults([track]);
        setTotal(1);
        setCurrentQuery(`Shared: ${track.title}`);
        setQuery(`${track.artist.name} - ${track.title}`);
      } catch (error) {
        console.error("[Shared Track] Failed to load shared track:", error);
        hapticLight();
      }
    },
    [player],
  );

  const performSearchRef = useRef(performSearch);
  const handleAlbumClickRef = useRef(handleAlbumClick);
  const handleSharedTrackRef = useRef(handleSharedTrack);
  const loadingRef = useRef(loading);

  useEffect(() => {
    performSearchRef.current = performSearch;
  }, [performSearch]);

  useEffect(() => {
    handleAlbumClickRef.current = handleAlbumClick;
  }, [handleAlbumClick]);

  useEffect(() => {
    handleSharedTrackRef.current = handleSharedTrack;
  }, [handleSharedTrack]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    const params = new URLSearchParams(searchParamsKey);
    const urlQuery = params.get("q");
    const albumId = params.get("album");
    const trackId = params.get("track");

    if (trackId) {
      const trackIdNum = parseInt(trackId, 10);
      if (!isNaN(trackIdNum) && trackId !== lastTrackIdRef.current) {
        lastTrackIdRef.current = trackId;
        setIsInitialized(true);
        lastUrlQueryRef.current = null;
        void handleSharedTrackRef.current(trackIdNum);
      }
    } else if (albumId) {
      const albumIdNum = parseInt(albumId, 10);
      if (!isNaN(albumIdNum)) {
        setIsInitialized(true);
        lastUrlQueryRef.current = null;
        lastTrackIdRef.current = null;
        void handleAlbumClickRef.current(albumIdNum);
      }
    } else if (urlQuery) {
      if (urlQuery !== lastUrlQueryRef.current) {
        lastUrlQueryRef.current = urlQuery;
        lastTrackIdRef.current = null;
        setQuery(urlQuery);
        setIsInitialized(true);
        shouldAutoPlayRef.current = true;
        void performSearchRef.current(urlQuery, true);
      }
    } else {
      setIsInitialized((prev) => (prev ? prev : true));
      if (lastUrlQueryRef.current !== null || lastTrackIdRef.current !== null) {
        lastUrlQueryRef.current = null;
        lastTrackIdRef.current = null;
        setResults([]);
        setTotal(0);
        setCurrentQuery("");
        if (!loadingRef.current) {
          setQuery("");
        }
      }
    }
  }, [searchParamsKey]);

  const updateURL = (searchQuery: string) => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) {
      params.set("q", searchQuery);
      router.push(`?${params.toString()}`, { scroll: false });
    } else {
      router.push("/", { scroll: false });
    }
  };

  const handleSearch = async (searchQuery?: string) => {
    const q = searchQuery ?? query;
    if (!q.trim()) return;

    updateURL(q);
  };

  const handleShareSearch = useCallback(
    async (searchQuery: string) => {
      const shareUrl = `${window.location.origin}/?q=${encodeURIComponent(searchQuery)}`;

      if (isShareSupported) {
        const success = await share({
          title: tm("searchPrefix", { query: searchQuery }),
          text: tm("searchResultsFor", { query: searchQuery }),
          url: shareUrl,
        });

        if (success) {
          showToast(t("searchLinkShared"), "success");
        }
        return;
      }

      try {
        await navigator.clipboard.writeText(shareUrl);
        showToast(t("searchLinkCopied"), "success");
      } catch {
        showToast(t("searchLinkShareFailed"), "error");
      }
    },
    [isShareSupported, share, showToast, t, tm],
  );

  const handleLoadMore = async () => {
    if (!currentQuery.trim() || loadingMore) return;

    setLoadingMore(true);

    try {
      if (isArtistSearch) {
        const currentApiOffset = apiOffset;
        const response = await searchTracksByArtist(
          currentQuery,
          currentApiOffset,
        );

        const API_PAGE_SIZE = 25;
        const newApiOffset = currentApiOffset + API_PAGE_SIZE;

        setResults((prev) => {
          const newResults = [...prev, ...response.data];

          if (!response.next) {
            setTotal(newResults.length);
          } else {
            setTotal(response.total);
          }

          return newResults;
        });

        setApiOffset(newApiOffset);
      } else {
        const nextOffset = results.length;
        if (nextOffset >= total) {
          setLoadingMore(false);
          return;
        }

        const response = await searchTracks(currentQuery, nextOffset);
        setResults((prev) => [...prev, ...response.data]);

        if (response.total !== total) {
          setTotal(response.total);
        }
      }
    } catch (error) {
      console.error("Load more failed:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleRefresh = async () => {
    if (currentQuery) {
      await performSearch(currentQuery);
    }
  };

  const handleArtistClick = useCallback(
    async (artistName: string) => {
      setLoading(true);
      setQuery(artistName);
      setCurrentQuery(artistName);
      setIsArtistSearch(true);
      setApiOffset(0);

      setResults([]);
      setTotal(0);

      try {
        const response = await searchTracksByArtist(artistName, 0);
        setResults(response.data);
        setTotal(response.total);

        const API_PAGE_SIZE = 25;
        setApiOffset(API_PAGE_SIZE);

        const params = new URLSearchParams();
        params.set("q", artistName);
        router.push(`?${params.toString()}`, { scroll: false });

        if (session) {
          addSearchQuery.mutate({ query: artistName });
        }
      } catch (error) {
        console.error("Artist search failed:", error);
        setResults([]);
        setTotal(0);
        setApiOffset(0);
      } finally {
        setLoading(false);
      }
    },
    [session, addSearchQuery, router],
  );

  const dedupeTracks = useCallback((tracks: Track[]) => {
    const seen = new Set<number>();
    const output: Track[] = [];

    for (const track of tracks) {
      if (!track || seen.has(track.id)) continue;
      seen.add(track.id);
      output.push(track);
    }

    return output;
  }, []);

  const dedupePlaylists = useCallback((playlists: PlaylistFeedItem[]) => {
    const seen = new Set<number>();
    const output: PlaylistFeedItem[] = [];

    for (const playlist of playlists) {
      if (!playlist || seen.has(playlist.id)) continue;
      seen.add(playlist.id);
      output.push(playlist);
    }

    return output;
  }, []);

  const historyTracks = useMemo(
    () => dedupeTracks((historyItems ?? []).map((item) => item.track)),
    [dedupeTracks, historyItems],
  );

  const favoriteTracks = useMemo(
    () => dedupeTracks((favoriteItems ?? []).map((item) => item.track)),
    [dedupeTracks, favoriteItems],
  );

  const continueListeningTracks = useMemo(
    () => dedupeTracks([...player.queue, ...historyTracks]).slice(0, 14),
    [dedupeTracks, historyTracks, player.queue],
  );

  const recentlyPlayedTracks = useMemo(
    () => historyTracks.slice(0, 14),
    [historyTracks],
  );

  const madeForYouRowTracks = useMemo(
    () => dedupeTracks([...favoriteTracks, ...madeForYouTracks]).slice(0, 14),
    [dedupeTracks, favoriteTracks, madeForYouTracks],
  );

  const newReleaseRowTracks = useMemo(
    () => dedupeTracks(newReleaseTracks).slice(0, 14),
    [dedupeTracks, newReleaseTracks],
  );

  const tastePlaylistsRow = useMemo(
    () => dedupePlaylists(tastePlaylists).slice(0, 8),
    [dedupePlaylists, tastePlaylists],
  );
  const isTasteFeedLoading =
    homeFeedEnabled && (!hasLoadedFeedCore || isFeedCoreLoading);
  const isTrackFeedLoading =
    homeFeedEnabled && (!hasLoadedFeedEnrichment || isFeedEnrichmentLoading);

  const tasteSeedArtists = useMemo(
    () =>
      Array.from(
        new Set(
          [...favoriteTracks, ...historyTracks]
            .map((track) => track.artist.name.trim())
            .filter((name) => name.length > 0),
        ),
      ).slice(0, 24),
    [favoriteTracks, historyTracks],
  );

  const tasteSeedPlaylistTitles = useMemo(
    () =>
      Array.from(
        new Set(
          [...favoriteTracks, ...historyTracks]
            .map((track) => track.album?.title?.trim())
            .filter((title): title is string => !!title && title.length > 0),
        ),
      ).slice(0, 24),
    [favoriteTracks, historyTracks],
  );

  useEffect(() => {
    if (!session) return;

    if (
      preferredGenreId === null &&
      preferredGenreName.trim().length === 0 &&
      tasteSeedArtists.length === 0 &&
      tasteSeedPlaylistTitles.length === 0
    ) {
      return;
    }

    const payload: TasteProfilePayload = {
      preferredGenreId,
      preferredGenreName: preferredGenreName.trim() || null,
      seedArtists: tasteSeedArtists,
      seedPlaylistTitles: tasteSeedPlaylistTitles,
    };
    const signature = JSON.stringify(payload);

    if (lastTasteSyncRef.current === signature) return;
    lastTasteSyncRef.current = signature;

    upsertTasteProfile.mutate(payload, {
      onError: (error) => {
        console.warn("[HomePageClient] Failed to sync taste profile:", error);
      },
    });
  }, [
    preferredGenreId,
    preferredGenreName,
    session,
    tasteSeedArtists,
    tasteSeedPlaylistTitles,
    upsertTasteProfile,
  ]);

  useEffect(() => {
    if (!homeFeedEnabled || !isHomeFeedIdleReady || hasLoadedFeedCore) return;

    let cancelled = false;

    const loadFeedRows = async () => {
      setIsFeedCoreLoading(true);

      try {
        const seedArtists = tasteSeedArtists.slice(0, 4);

        const [latestReleases, popularPlaylists, genrePlaylists] =
          await Promise.all([
            getLatestReleases(24).catch(() => []),
            getPopularPlaylists(36).catch(() => []),
            preferredGenreId
              ? getPlaylistsByGenreId(preferredGenreId, 40).catch(() => [])
              : preferredGenreName
                ? getPlaylistsByGenre(preferredGenreName, 40).catch(() => [])
                : Promise.resolve([]),
          ]);

        if (cancelled) return;

        const tasteSeedTitles = new Set(
          (Array.isArray(tasteProfile?.seedPlaylistTitles)
            ? tasteProfile.seedPlaylistTitles
            : []
          )
            .map((title) =>
              typeof title === "string" ? title.trim().toLowerCase() : "",
            )
            .filter((title) => title.length > 0),
        );

        const preferredGenreNameLower = preferredGenreName.trim().toLowerCase();

        const curatedTastePlaylists = dedupePlaylists([
          ...genrePlaylists,
          ...popularPlaylists.filter((playlist) => {
            const title = playlist.title.trim().toLowerCase();
            if (!title) return false;

            if (
              preferredGenreNameLower &&
              title.includes(preferredGenreNameLower)
            ) {
              return true;
            }

            for (const seedTitle of tasteSeedTitles) {
              if (title.includes(seedTitle) || seedTitle.includes(title)) {
                return true;
              }
            }

            return false;
          }),
          ...popularPlaylists,
        ]).slice(0, 24);

        const releaseQueries = uniqueNonEmptyStrings([
          ...latestReleases
            .map((release) =>
              [release.artist?.name?.trim(), release.title?.trim()]
                .filter((part) => (part ?? "").length > 0)
                .join(" "),
            )
            .filter((query) => query.length > 0),
          `${new Date().getFullYear()} latest releases`,
          "fresh new music",
        ]).slice(0, 8);

        const madeForYouQueries = uniqueNonEmptyStrings([
          ...genrePlaylists
            .map((playlist) => playlist.title ?? "")
            .slice(0, 10),
          ...popularPlaylists
            .map((playlist) => playlist.title ?? "")
            .slice(0, 8),
          ...seedArtists.map((artist) => `${artist} essentials`),
          preferredGenreName ? `${preferredGenreName} essentials` : "",
        ]).slice(0, 10);

        setTastePlaylists(curatedTastePlaylists);
        setFeedReleaseQueries(releaseQueries);
        setFeedMadeForYouQueries(madeForYouQueries);
        setHasLoadedFeedCore(true);
      } finally {
        if (!cancelled) {
          setIsFeedCoreLoading(false);
        }
      }
    };

    void loadFeedRows();

    return () => {
      cancelled = true;
    };
  }, [
    dedupePlaylists,
    hasLoadedFeedCore,
    homeFeedEnabled,
    isHomeFeedIdleReady,
    preferredGenreId,
    preferredGenreName,
    tasteProfile,
    tasteSeedArtists,
  ]);

  useEffect(() => {
    if (
      !homeFeedEnabled ||
      !hasLoadedFeedCore ||
      hasLoadedFeedEnrichment ||
      !isFeedSectionNearViewport ||
      !isPageVisible
    ) {
      return;
    }

    let cancelled = false;

    const cancelIdleTask = scheduleBrowserIdleTask(() => {
      const loadFeedEnrichment = async () => {
        setIsFeedEnrichmentLoading(true);

        try {
          const [madeForYouResults, newReleaseResults] = await Promise.all([
            collectTracksFromQueries(feedMadeForYouQueries, {
              maxRequests: 5,
              perQueryLimit: 6,
              targetCount: 24,
            }),
            collectTracksFromQueries(feedReleaseQueries, {
              maxRequests: 4,
              perQueryLimit: 3,
              targetCount: 24,
            }),
          ]);

          if (cancelled) return;

          setMadeForYouTracks(
            dedupeTracks([...favoriteTracks, ...madeForYouResults]).slice(
              0,
              24,
            ),
          );
          setNewReleaseTracks(dedupeTracks(newReleaseResults).slice(0, 24));
          setHasLoadedFeedEnrichment(true);
        } finally {
          if (!cancelled) {
            setIsFeedEnrichmentLoading(false);
          }
        }
      };

      void loadFeedEnrichment();
    }, 1000);

    return () => {
      cancelled = true;
      cancelIdleTask();
    };
  }, [
    dedupeTracks,
    favoriteTracks,
    feedMadeForYouQueries,
    feedReleaseQueries,
    hasLoadedFeedCore,
    hasLoadedFeedEnrichment,
    homeFeedEnabled,
    isFeedSectionNearViewport,
    isPageVisible,
  ]);

  const hasMore = results.length < total;
  const featuredAlbums = [
    {
      title: "Mezzanine",
      artist: "Massive Attack",
      query: "Massive Attack Mezzanine",
      tint: "from-[rgba(244,178,102,0.34)] to-[rgba(14,14,14,0.92)]",
    },
    {
      title: "Felt Mountain",
      artist: "Goldfrapp",
      query: "Goldfrapp Felt Mountain",
      tint: "from-[rgba(88,198,177,0.34)] to-[rgba(14,14,14,0.92)]",
    },
    {
      title: "Homogenic",
      artist: "Björk",
      query: "Björk Homogenic",
      tint: "from-[rgba(255,255,255,0.22)] to-[rgba(14,14,14,0.92)]",
    },
    {
      title: "Violator",
      artist: "Depeche Mode",
      query: "Depeche Mode Violator",
      tint: "from-[rgba(244,178,102,0.26)] to-[rgba(20,20,20,0.94)]",
    },
  ];
  const playlistTiles = (userPlaylists ?? []).slice(0, 4);
  const greeting =
    new Date().getHours() < 12
      ? t("greetingMorning")
      : new Date().getHours() < 18
        ? t("greetingAfternoon")
        : t("greetingEvening");

  const handleShufflePlay = useCallback(async () => {
    hapticSuccess();
    setLoading(true);

    setResults([]);
    setTotal(0);

    try {
      const popularQueries = [
        preferredGenreName,
        "pop",
        "rock",
        "electronic",
        "jazz",
        "indie",
      ].filter((value) => value.trim().length > 0);
      const randomQuery =
        popularQueries[Math.floor(Math.random() * popularQueries.length)];

      const response = await searchTracks(randomQuery!, 0);

      if (response.data.length > 0) {
        const shuffled = [...response.data].sort(() => Math.random() - 0.5);

        player.playTrack(shuffled[0]!);

        if (shuffled.length > 1) {
          player.addToQueue(shuffled.slice(1, 11), false);
        }

        setResults(response.data);
        setTotal(response.total);
        setCurrentQuery(randomQuery ?? "");
      }
    } catch (error) {
      console.error("Shuffle play failed:", error);
    } finally {
      setLoading(false);
    }
  }, [player, preferredGenreName]);

  const handleFeedTrackSelect = useCallback(
    (track: Track, rowTracks: Track[]) => {
      hapticSuccess();
      player.playTrack(track);

      const remainingTracks = rowTracks.filter((item) => item.id !== track.id);
      if (remainingTracks.length > 0) {
        player.addToQueue(remainingTracks.slice(0, 12), false);
      }
    },
    [player],
  );

  if (!mounted) {
    return null;
  }

  const searchContent = (
    <div className="flex min-h-screen flex-col">
      <main className="container mx-auto w-full flex-1 py-6 md:py-5">
        <div className="w-full">
          {!isMobile && (
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springPresets.gentle}
              className="mb-5 overflow-hidden rounded-[1.05rem] border border-[color:var(--shell-border)] bg-[linear-gradient(180deg,rgba(244,178,102,0.16)_0%,rgba(20,24,30,0.9)_38%,rgba(14,17,22,0.94)_100%)] px-5 py-5 md:px-6 md:py-6"
            >
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.16em] text-white/75 uppercase">
                    {t("discover")}
                  </p>
                  <h1 className="text-(--color-text)] mt-1 text-2xl font-extrabold md:text-3xl">
                    {greeting}
                  </h1>
                  <p className="mt-1 text-sm text-(--color-subtext)">
                    {t("tagline")}
                    {apiHostname
                      ? ` ${t("poweredBy", { host: apiHostname })}`
                      : ""}
                  </p>
                  <div className="mt-4 max-w-2xl rounded-[0.9rem] border border-white/8 bg-black/12 px-4 py-4">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-(--color-accent)" />
                      <p className="text-[11px] font-semibold tracking-[0.16em] text-white/75 uppercase">
                        {t("whatsNew")}
                      </p>
                    </div>
                    <ul className="mt-3 space-y-1.5 text-sm text-(--color-subtext)">
                      <li>{t("spotifySavePrompt")}</li>
                    </ul>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          hapticLight();
                          router.push("/settings");
                        }}
                        className="btn-secondary inline-flex items-center gap-2 px-3 py-2 text-[11px] font-bold tracking-wide uppercase"
                      >
                        {t("openSettings")}
                      </button>
                      <a
                        href="https://developer.spotify.com/documentation/web-api/concepts/apps"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-white/8 bg-white/4 px-3 py-2 text-[11px] font-bold tracking-wide text-(--color-text) uppercase transition hover:border-(--color-accent)/22 hover:bg-white/8"
                      >
                        {t("howTo")}
                      </a>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void handleShufflePlay()}
                    className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs font-bold tracking-wide uppercase"
                  >
                    <Shuffle className="h-3.5 w-3.5" />
                    {t("shufflePlay")}
                  </button>
                  {currentQuery && (
                    <button
                      onClick={() => void handleShareSearch(currentQuery)}
                      className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-xs font-bold tracking-wide uppercase"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      {t("shareQuery")}
                    </button>
                  )}
                </div>
              </div>
            </motion.section>
          )}

          <AnimatePresence mode="wait">
            {results.length > 0 ? (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-4 flex items-center justify-between gap-4 md:mb-3">
                  <div>
                    <h2 className="text-lg font-bold text-(--color-text) md:text-xl">
                      {isArtistSearch
                        ? t("artistRadio", { query: currentQuery })
                        : currentQuery
                          ? t("resultsFor", { query: currentQuery })
                          : t("searchResults")}
                    </h2>
                    <p className="mt-0.5 text-xs text-(--color-subtext) md:mt-0.5 md:text-xs">
                      {total > visibleResults.length
                        ? t("resultsCountWithTotal", {
                            visible: visibleResults.length,
                            total,
                          })
                        : t("resultsCount", { count: visibleResults.length })}
                    </p>
                  </div>
                  {currentQuery && (
                    <button
                      onClick={() => void handleShareSearch(currentQuery)}
                      className="btn-secondary hidden items-center gap-1 px-3 py-1.5 text-xs font-semibold md:inline-flex"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      {tc("share")}
                    </button>
                  )}
                </div>

                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                  className="grid gap-2 md:gap-1.5"
                >
                  {visibleResults.map((track, index) => (
                    <motion.div key={track.id} variants={staggerItem}>
                      <SwipeableTrackCard
                        track={track}
                        onPlay={player.play}
                        onAddToQueue={player.addToQueue}
                        showActions={!!session}
                        index={index}
                        onArtistClick={handleArtistClick}
                        onAlbumClick={handleAlbumClick}
                      />
                    </motion.div>
                  ))}
                </motion.div>

                {hasMore && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 flex justify-center md:mt-5"
                  >
                    <button
                      onClick={() => void handleLoadMore()}
                      disabled={loadingMore}
                      className="btn-primary touch-target-lg flex w-full items-center justify-center gap-2 md:w-auto md:px-8 md:text-sm"
                    >
                      {loadingMore ? (
                        <>
                          <div className="spinner spinner-sm" />
                          <span>{tc("loading")}</span>
                        </>
                      ) : (
                        tc("loadMore", {
                          remaining: total - visibleResults.length,
                        })
                      )}
                    </button>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={springPresets.gentle}
                className="space-y-4"
              >
                {homeFeedEnabled && (
                  <div className="space-y-4">
                    <div
                      ref={feedSectionAnchorRef}
                      className="h-px w-full"
                      aria-hidden="true"
                    />
                    <HomeFeedRow
                      title={t("continueListening")}
                      subtitle={t("continueListeningSubtitle")}
                      tracks={continueListeningTracks}
                      onTrackSelect={(track) =>
                        handleFeedTrackSelect(track, continueListeningTracks)
                      }
                      isLoading={
                        !!session &&
                        historyLoading &&
                        continueListeningTracks.length === 0
                      }
                      emptyLabel={t("continueListeningEmpty")}
                    />
                    <HomeFeedRow
                      title={t("recentlyPlayed")}
                      subtitle={t("recentlyPlayedSubtitle")}
                      tracks={recentlyPlayedTracks}
                      onTrackSelect={(track) =>
                        handleFeedTrackSelect(track, recentlyPlayedTracks)
                      }
                      isLoading={
                        !!session &&
                        historyLoading &&
                        recentlyPlayedTracks.length === 0
                      }
                      emptyLabel={t("recentlyPlayedEmpty")}
                    />
                    <HomeFeedRow
                      title={t("madeForYou")}
                      subtitle={
                        preferredGenreName
                          ? t("madeForYouSubtitleGenre", {
                              genre: preferredGenreName,
                            })
                          : t("madeForYouSubtitle")
                      }
                      tracks={madeForYouRowTracks}
                      onTrackSelect={(track) =>
                        handleFeedTrackSelect(track, madeForYouRowTracks)
                      }
                      isLoading={
                        (favoritesLoading || isTrackFeedLoading) &&
                        madeForYouRowTracks.length === 0
                      }
                      emptyLabel={t("madeForYouEmpty")}
                    />
                    <section className="card p-4 text-left md:p-5">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <ListMusic className="h-4 w-4 text-(--color-secondary-accent)" />
                          <h4 className="text-sm font-bold tracking-wide text-(--color-text) uppercase">
                            {t("playlistsForYourTaste")}
                          </h4>
                        </div>
                        {preferredGenreName && (
                          <span className="rounded-full border border-(--color-border) bg-(--color-surface) px-2 py-0.5 text-[11px] text-(--color-subtext)">
                            {preferredGenreName}
                          </span>
                        )}
                      </div>
                      {isTasteFeedLoading && tastePlaylistsRow.length === 0 ? (
                        <div className="flex items-center justify-center py-5">
                          <div className="spinner spinner-sm" />
                        </div>
                      ) : tastePlaylistsRow.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                          {tastePlaylistsRow.map((playlist) => {
                            const artwork =
                              playlist.picture_medium ??
                              playlist.picture ??
                              playlist.picture_big ??
                              "";
                            const title = playlist.title.trim();
                            const path = title
                              ? `/discover/playlists/${playlist.id}?title=${encodeURIComponent(title)}`
                              : `/discover/playlists/${playlist.id}`;

                            return (
                              <button
                                key={playlist.id}
                                onClick={() => {
                                  hapticLight();
                                  router.push(path);
                                }}
                                onContextMenu={(event) => {
                                  event.preventDefault();
                                  hapticLight();
                                  openPlaylistMenu(
                                    {
                                      id: playlist.id,
                                      name: playlist.title,
                                      description: playlist.user?.name
                                        ? t("playlistBy", {
                                            name: playlist.user.name,
                                          })
                                        : null,
                                      isPublic: true,
                                      coverImage: artwork || null,
                                      trackCount: playlist.nb_tracks ?? 0,
                                    },
                                    event.clientX,
                                    event.clientY,
                                    {
                                      mode: "foreign",
                                      openPath: path,
                                      shareUrl: `${window.location.origin}${path}`,
                                      resolveTracks: async () => {
                                        const response = await fetch(
                                          `/api/playlist/${playlist.id}`,
                                          { cache: "no-store" },
                                        );
                                        if (!response.ok) {
                                          let message = t(
                                            "failedToFetchPlaylistTracks",
                                            {
                                              status: response.status,
                                              statusText: response.statusText,
                                            },
                                          );
                                          try {
                                            const errorBody =
                                              await response.text();
                                            if (errorBody) {
                                              const snippet =
                                                errorBody.length > 500
                                                  ? `${errorBody.slice(0, 500)}…`
                                                  : errorBody;
                                              message += `: ${snippet}`;
                                            }
                                          } catch {
                                            // Ignore errors while reading error body; fall back to base message.
                                          }
                                          throw new Error(message);
                                        }
                                        const payload =
                                          (await response.json()) as unknown;
                                        return parseFeedPlaylistTracks(payload);
                                      },
                                    },
                                  );
                                }}
                                className="group rounded-xl border border-white/10 bg-(--color-surface)/70 p-2 text-left transition-all hover:scale-[1.01] hover:border-white/20"
                              >
                                <div className="aspect-square w-full overflow-hidden rounded-lg bg-[rgba(255,255,255,0.05)]">
                                  {artwork ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={artwork}
                                      alt={playlist.title}
                                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-xs text-(--color-subtext)">
                                      {t("playlistCoverFallback")}
                                    </div>
                                  )}
                                </div>
                                <p className="mt-2 line-clamp-2 text-xs font-semibold text-(--color-text)">
                                  {playlist.title}
                                </p>
                                <p className="line-clamp-1 text-[11px] text-(--color-subtext)">
                                  {tc("tracks", {
                                    count: playlist.nb_tracks ?? 0,
                                  })}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-(--color-subtext)">
                          {t("playlistsForYourTasteEmpty")}
                        </p>
                      )}
                    </section>
                    <HomeFeedRow
                      title={t("newReleases")}
                      subtitle={t("newReleasesSubtitle")}
                      tracks={newReleaseRowTracks}
                      onTrackSelect={(track) =>
                        handleFeedTrackSelect(track, newReleaseRowTracks)
                      }
                      isLoading={
                        isTrackFeedLoading && newReleaseRowTracks.length === 0
                      }
                      emptyLabel={t("newReleasesEmpty")}
                    />
                  </div>
                )}

                {!isMobile && (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <section className="card p-4 text-left md:p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <Disc3 className="h-4 w-4 text-(--color-accent)" />
                        <h4 className="text-sm font-bold tracking-wide text-(--color-text) uppercase">
                          {t("albumPicks")}
                        </h4>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        {featuredAlbums.map((album) => (
                          <button
                            key={`${album.artist}-${album.title}`}
                            onClick={() => {
                              hapticLight();
                              setQuery(album.query);
                              void handleSearch(album.query);
                            }}
                            className={`group rounded-xl border border-white/10 bg-linear-to-br p-3 text-left transition-all hover:scale-[1.02] hover:border-white/20 ${album.tint}`}
                          >
                            <p className="line-clamp-1 text-sm font-semibold text-(--color-text)">
                              {album.title}
                            </p>
                            <p className="mt-1 line-clamp-1 text-xs text-(--color-subtext)">
                              {album.artist}
                            </p>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="card p-4 text-left md:p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <ListMusic className="h-4 w-4 text-(--color-secondary-accent)" />
                        <h4 className="text-sm font-bold tracking-wide text-(--color-text) uppercase">
                          {t("playlistGrid")}
                        </h4>
                      </div>
                      {playlistTiles.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2.5">
                          {playlistTiles.map((playlist) => (
                            <button
                              key={playlist.id}
                              onClick={() => {
                                hapticLight();
                                router.push(`/playlists/${playlist.id}`);
                              }}
                              className="group rounded-xl border border-white/10 bg-[linear-gradient(160deg,rgba(88,198,177,0.24),rgba(14,14,14,0.94))] p-3 text-left transition-all hover:scale-[1.02] hover:border-white/20"
                            >
                              <p className="line-clamp-1 text-sm font-semibold text-(--color-text)">
                                {playlist.name}
                              </p>
                              <p className="mt-1 line-clamp-1 text-xs text-(--color-subtext)">
                                {tc("tracks", {
                                  count: playlist.trackCount ?? 0,
                                })}
                              </p>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <button
                            onClick={() => {
                              hapticLight();
                              router.push("/playlists/12");
                            }}
                            className="w-full rounded-xl border border-white/10 bg-[linear-gradient(160deg,rgba(88,198,177,0.24),rgba(14,14,14,0.94))] px-3 py-3 text-left transition-all hover:border-white/20"
                          >
                            <p className="text-sm font-semibold text-(--color-text)">
                              {t("examplePlaylist")}
                            </p>
                            <p className="text-xs text-(--color-subtext)">
                              {t("curatedStarterSelection")}
                            </p>
                          </button>
                          <button
                            onClick={() => {
                              hapticLight();
                              router.push(
                                session
                                  ? "/playlists"
                                  : "/signin?callbackUrl=%2Fplaylists",
                              );
                            }}
                            className="w-full rounded-xl border border-white/10 bg-[rgba(255,255,255,0.04)] px-3 py-3 text-left transition-all hover:border-white/20"
                          >
                            <p className="text-sm font-semibold text-(--color-text)">
                              {t("yourPlaylists")}
                            </p>
                            <p className="text-xs text-(--color-subtext)">
                              {t("openLibraryDescription")}
                            </p>
                          </button>
                        </div>
                      )}
                    </section>
                  </div>
                )}

                <div className="card flex flex-col items-center justify-center py-12 text-center md:py-10">
                  <motion.div
                    animate={{
                      scale: [1, 1.05, 1],
                      rotate: [0, 5, -5, 0],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-[rgba(244,178,102,0.12)] to-[rgba(244,178,102,0.04)] ring-1 ring-(--color-accent)/16 md:mb-3 md:h-16 md:w-16"
                  >
                    <Music2 className="h-10 w-10 text-(--color-accent) md:h-8 md:w-8" />
                  </motion.div>
                  <h3 className="mb-2 text-lg font-bold text-(--color-text) md:mb-1.5 md:text-base">
                    {isMobile
                      ? t("mobileStartPrompt")
                      : t("desktopStartPrompt")}
                  </h3>

                  {session && recentSearches && recentSearches.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...springPresets.gentle, delay: 0.1 }}
                      className="mt-4 w-full max-w-5xl"
                    >
                      <div className="mb-1.5 text-left text-[11px] font-semibold tracking-wide text-(--color-subtext) uppercase">
                        {t("pastSearches")}
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                        {recentSearches
                          .slice(0, 16)
                          .map((search: string, index: number) => (
                            <motion.div
                              key={`${search}-${index}`}
                              whileTap={{ scale: 0.98 }}
                              className="theme-panel flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors hover:bg-(--color-surface-hover)"
                            >
                              <button
                                onClick={() => {
                                  hapticLight();
                                  setQuery(search);
                                  void handleSearch(search);
                                }}
                                className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                              >
                                <Search className="h-3.5 w-3.5 shrink-0 text-(--color-muted)" />
                                <span className="truncate text-xs text-(--color-text)">
                                  {search}
                                </span>
                              </button>

                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  hapticLight();
                                  void handleShareSearch(search);
                                }}
                                className="electron-no-drag inline-flex items-center gap-1 rounded-full border border-[color:var(--shell-border)] bg-[color:var(--shell-muted-bg)] px-2 py-1 text-[11px] font-medium text-(--color-subtext) transition-colors hover:border-(--color-accent)/20 hover:text-(--color-text)"
                                title={t("shareSearch")}
                                aria-label={t("shareSearchFor", {
                                  query: search,
                                })}
                              >
                                <Share2 className="h-3 w-3" />
                                {tc("share")}
                              </button>
                            </motion.div>
                          ))}
                      </div>
                    </motion.div>
                  )}

                  {isMobile && (
                    <motion.button
                      onClick={handleShufflePlay}
                      disabled={loading}
                      whileTap={{ scale: 0.95 }}
                      className="mt-6 flex w-full max-w-xs items-center justify-center gap-3 rounded-2xl bg-linear-to-r from-(--color-accent) to-(--color-accent-strong) px-8 py-4 text-lg font-bold text-(--color-on-accent) shadow-(--color-accent)/25 shadow-lg transition-all hover:shadow-(--color-accent)/40 hover:shadow-xl disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <div className="spinner spinner-sm border-white" />
                          <span>{tc("loading")}</span>
                        </>
                      ) : (
                        <>
                          <Shuffle className="h-6 w-6" />
                          <span>{t("shuffleAndPlay")}</span>
                        </>
                      )}
                    </motion.button>
                  )}

                  <div className="mt-6 flex flex-wrap justify-center gap-2 md:mt-4 md:gap-1.5">
                    {[
                      "Lamb",
                      "Depeche Mode",
                      "The Knife",
                      "Goldfrapp",
                      "GusGus",
                      "Soulwax",
                      "Massive Attack",
                    ].map((suggestion) => (
                      <motion.button
                        key={suggestion}
                        onClick={() => {
                          hapticLight();
                          setQuery(suggestion);
                          void handleSearch(suggestion);
                        }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-2 rounded-full bg-[rgba(244,178,102,0.1)] px-4 py-2 text-sm text-(--color-accent) transition-colors hover:bg-[rgba(244,178,102,0.2)] md:px-3 md:py-1.5 md:text-xs"
                      >
                        <Sparkles className="h-3 w-3 md:h-2.5 md:w-2.5" />
                        {suggestion}
                      </motion.button>
                    ))}
                  </div>

                  <div className="mt-8 flex flex-wrap items-center justify-center gap-3 md:mt-5 md:gap-2">
                    <motion.a
                      href="https://gitlab.com/soulwax/darkfloor-player.git"
                      target="_blank"
                      rel="noopener noreferrer"
                      whileTap={{ scale: 0.95 }}
                      className="btn-github flex items-center gap-2 rounded-xl bg-[rgba(255,255,255,0.05)] px-5 py-3 text-sm font-medium text-(--color-text) ring-1 ring-white/10 transition-all hover:bg-[rgba(255,255,255,0.1)] hover:ring-(--color-accent)/30 md:px-3 md:py-2 md:text-xs"
                    >
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 shrink-0 md:h-4 md:w-4"
                      >
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg>
                      <span>{t("viewOnGithub")}</span>
                    </motion.a>

                    <motion.button
                      onClick={() => {
                        hapticLight();
                        setIsChangelogOpen(true);
                      }}
                      whileTap={{ scale: 0.95 }}
                      className="flex items-center gap-2 rounded-xl bg-[rgba(244,178,102,0.1)] px-5 py-3 text-sm font-medium text-(--color-accent) ring-1 ring-(--color-accent)/20 transition-all hover:bg-[rgba(244,178,102,0.2)] hover:ring-(--color-accent)/40 md:px-3 md:py-2 md:text-xs"
                    >
                      <BookOpen className="h-4 w-4 md:h-3.5 md:w-3.5" />
                      <span>{t("changelog")}</span>
                    </motion.button>

                    <motion.button
                      onClick={() => {
                        hapticLight();
                        router.push("/playlists/12");
                      }}
                      whileTap={{ scale: 0.95 }}
                      className="ml-6 flex items-center gap-2 rounded-xl bg-[rgba(88,198,177,0.15)] px-4 py-2.5 text-sm font-medium text-(--color-text) ring-1 ring-(--color-secondary-accent)/20 transition-all hover:bg-[rgba(88,198,177,0.25)] hover:ring-(--color-secondary-accent)/40 md:ml-4 md:px-3 md:py-2 md:text-xs"
                    >
                      <Music2 className="h-4 w-4 md:h-3.5 md:w-3.5" />
                      <span>{t("examplePlaylist")}</span>
                    </motion.button>
                  </div>

                  <p className="mt-8 text-xs font-medium tracking-wider text-(--color-muted) uppercase md:mt-6">
                    {tc("copyright", { year: new Date().getFullYear() })}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {isChangelogOpen && (
        <ChangelogModal
          isOpen={isChangelogOpen}
          onClose={() => setIsChangelogOpen(false)}
        />
      )}
    </div>
  );

  if (isMobile) {
    return (
      <PullToRefreshWrapper onRefresh={handleRefresh} enabled={!!currentQuery}>
        {searchContent}
      </PullToRefreshWrapper>
    );
  }

  return searchContent;
}
