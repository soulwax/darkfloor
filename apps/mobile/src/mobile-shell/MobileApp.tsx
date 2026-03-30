import type { JSX } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { Track } from "@starchild/player-core";

import { MOBILE_SHELL_INFO } from "../index";
import {
  ArtistCard,
  BottomTabBar,
  CollectionCard,
  EmptyState,
  MetricCard,
  NowPlayingDock,
  SearchField,
  SectionHeading,
  StatusPill,
  TrackRow,
} from "./components";
import { MOBILE_DEMO_LIBRARY } from "./data";
import { formatTrackDuration, mobileTheme } from "./theme";
import { useMobileShellState } from "./useMobileShellState";
import type { MobileMetric, MobileTabId } from "./types";

interface TrackPanelContent {
  title: string;
  subtitle: string;
  tracks: Track[];
  tone: "blue" | "mint" | "coral" | "gold";
}

function getPrimaryTrackPanel(
  activeTab: MobileTabId,
  searchResults: Track[],
  deferredSearchQuery: string,
): TrackPanelContent {
  switch (activeTab) {
    case "discover":
      return {
        title: "Fresh picks",
        subtitle:
          "Recommendations pulled from the same shared contracts we can wire into live APIs next.",
        tracks: MOBILE_DEMO_LIBRARY.recommendedTracks,
        tone: "gold",
      };
    case "library":
      return {
        title: "Saved favorites",
        subtitle:
          "Pinned material for the first signed-in library sync pass.",
        tracks: MOBILE_DEMO_LIBRARY.favoriteTracks,
        tone: "mint",
      };
    case "search":
      return {
        title: deferredSearchQuery
          ? `Results for "${deferredSearchQuery}"`
          : "Search results",
        subtitle: deferredSearchQuery
          ? "Track, artist, and album matches from the staged mobile shell catalog."
          : "Type above to search the shared demo catalog.",
        tracks: searchResults,
        tone: "blue",
      };
    case "home":
    default:
      return {
        title: "Up next",
        subtitle:
          "The queue surface is ready for real playback state and resume behavior.",
        tracks: MOBILE_DEMO_LIBRARY.upNext.map((queuedTrack) => queuedTrack.track),
        tone: "coral",
      };
  }
}

function getSupportPanelCopy(activeTab: MobileTabId): {
  title: string;
  subtitle: string;
} {
  switch (activeTab) {
    case "discover":
      return {
        title: "Artist radar",
        subtitle:
          "Keep discovery human-friendly while the real recommendation transport lands.",
      };
    case "library":
      return {
        title: "Your collections",
        subtitle:
          "Saved sets become the natural bridge to mobile playlist management.",
      };
    case "search":
      return {
        title: "Search prompts",
        subtitle:
          "Useful starter queries while the mobile catalog is still staged locally.",
      };
    case "home":
    default:
      return {
        title: "Curated collections",
        subtitle:
          "These cards keep the shell feeling like a real listener app instead of a placeholder.",
      };
  }
}

function getSessionMetrics(
  queueLength: number,
  hydrationSource: "default" | "restored",
): readonly MobileMetric[] {
  return [
    {
      label: "Queue depth",
      value: String(queueLength).padStart(2, "0"),
      hint: "Now playing plus the rest of the staged queue.",
    },
    {
      label: "Shell state",
      value: hydrationSource === "restored" ? "Saved" : "Fresh",
      hint:
        hydrationSource === "restored"
          ? "Recovered from the last stored mobile session."
          : "Starts clean, then persists once the shell changes.",
    },
    {
      label: "Visualizers",
      value: String(MOBILE_SHELL_INFO.supportedVisualizerTypes.length).padStart(
        2,
        "0",
      ),
      hint:
        "Shared visualizer contracts are already available for the mobile runtime.",
    },
  ];
}

export function MobileApp(): JSX.Element {
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 980;
  const {
    activeTab,
    deferredSearchQuery,
    navTabs,
    searchQuery,
    searchResults,
    setActiveTab,
    setSearchQuery,
    state,
  } = useMobileShellState();
  const primaryPanel = getPrimaryTrackPanel(
    activeTab,
    searchResults,
    deferredSearchQuery,
  );
  const supportCopy = getSupportPanelCopy(activeTab);
  const sessionMetrics = getSessionMetrics(
    state.queueLength,
    state.hydrationSource,
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.screen}
      >
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentInner}>
            <View
              style={[
                styles.header,
                isWideLayout ? styles.headerWide : styles.headerStack,
              ]}
            >
              <View style={styles.headerCopy}>
                <Text style={styles.kicker}>Starchild Mobile</Text>
                <Text style={styles.title}>
                  A proper React Native shell for queue, library, and search
                  work.
                </Text>
                <Text style={styles.description}>
                  The mobile workspace now boots through a typed shell state
                  controller, restores the last session when browser storage is
                  available, and keeps its player contracts aligned with web and
                  desktop while the Expo native path stays open.
                </Text>
              </View>

              <View style={styles.headerPills}>
                <StatusPill label="Platform" value={Platform.OS} />
                <StatusPill
                  label="Shell state"
                  value={
                    state.hydrationSource === "restored" ? "restored" : "fresh"
                  }
                />
                <StatusPill label="Repeat" value={state.repeatMode} />
              </View>
            </View>

            <SearchField onChangeText={setSearchQuery} value={searchQuery} />

            <View
              style={[
                styles.heroGrid,
                isWideLayout ? styles.heroGridWide : styles.heroGridStack,
              ]}
            >
              <View style={styles.heroCard}>
                <Text style={styles.heroEyebrow}>Now playing</Text>
                <Text style={styles.heroTitle}>
                  {MOBILE_DEMO_LIBRARY.nowPlaying.track.title}
                </Text>
                <Text style={styles.heroSubtitle}>
                  {MOBILE_DEMO_LIBRARY.nowPlaying.track.artist.name} •{" "}
                  {MOBILE_DEMO_LIBRARY.nowPlaying.track.album.title}
                </Text>
                <Text style={styles.heroBody}>
                  Shared playback state already describes the current track, the
                  queue length, and repeat mode. The shell now persists that
                  frame of reference as well, giving the mobile runtime a real
                  boot/resume seam instead of a one-shot demo render.
                </Text>

                <View style={styles.heroPills}>
                  <StatusPill
                    label="Queue"
                    value={`${state.queueLength} tracks`}
                  />
                  <StatusPill
                    label="Duration"
                    value={formatTrackDuration(
                      MOBILE_DEMO_LIBRARY.nowPlaying.track.duration,
                    )}
                  />
                  <StatusPill
                    label="Resume"
                    value="local shell"
                  />
                </View>

                <View style={styles.progressTrack}>
                  <View style={styles.progressFill} />
                </View>
              </View>

              <View style={styles.metricSection}>
                <SectionHeading
                  subtitle="Typed runtime indicators that reflect how the shell now boots and persists."
                  title="Session status"
                />
                <View style={styles.metricGrid}>
                  {sessionMetrics.map((metric) => (
                    <MetricCard key={metric.label} metric={metric} />
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeading
                subtitle="These cards sketch the mobile-first jobs this app should eventually own."
                title="Quick actions"
              />
              <ScrollView
                contentContainerStyle={styles.horizontalRail}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {MOBILE_DEMO_LIBRARY.quickActions.map((action) => (
                  <CollectionCard
                    collection={{
                      curator: action.value,
                      id: action.id,
                      subtitle: action.description,
                      title: action.label,
                      tone: action.tone,
                      trackCount: 0,
                    }}
                    key={action.id}
                  />
                ))}
              </ScrollView>
            </View>

            <View
              style={[
                styles.supportGrid,
                isWideLayout ? styles.supportGridWide : styles.supportGridStack,
              ]}
            >
              <View style={styles.section}>
                <SectionHeading
                  subtitle={primaryPanel.subtitle}
                  title={primaryPanel.title}
                />

                {primaryPanel.tracks.length > 0 ? (
                  <View style={styles.trackList}>
                    {primaryPanel.tracks.map((track) => (
                      <TrackRow
                        caption={track.album.title}
                        key={track.id}
                        tone={primaryPanel.tone}
                        track={track}
                      />
                    ))}
                  </View>
                ) : (
                  <EmptyState
                    body="Try a song title, artist name, album, or a release date such as 2026-03-24."
                    title="No matches yet"
                  />
                )}
              </View>

              <View style={styles.section}>
                <SectionHeading
                  subtitle={supportCopy.subtitle}
                  title={supportCopy.title}
                />

                {activeTab === "discover" ? (
                  <View style={styles.cardStack}>
                    {MOBILE_DEMO_LIBRARY.artists.map((artist) => (
                      <ArtistCard artist={artist} key={artist.id} />
                    ))}
                  </View>
                ) : activeTab === "search" ? (
                  <View style={styles.promptStack}>
                    {MOBILE_DEMO_LIBRARY.searchPrompts.map((prompt) => (
                      <View key={prompt} style={styles.promptCard}>
                        <Text style={styles.promptTitle}>{prompt}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <ScrollView
                    contentContainerStyle={styles.horizontalRail}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                  >
                    {MOBILE_DEMO_LIBRARY.collections.map((collection) => (
                      <CollectionCard
                        collection={collection}
                        key={collection.id}
                      />
                    ))}
                  </ScrollView>
                )}
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeading
                subtitle="A second list keeps the shell honest about the kinds of scrolling surfaces a real listener app needs."
                title="Recently played"
              />

              <View style={styles.trackList}>
                {MOBILE_DEMO_LIBRARY.recentTracks.map((track) => (
                  <TrackRow
                    caption={`released ${track.release_date ?? "unknown"}`}
                    key={track.id}
                    tone="blue"
                    track={track}
                  />
                ))}
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.bottomChrome}>
          <View style={styles.bottomChromeInner}>
            <NowPlayingDock
              queueLength={state.queueLength}
              repeatMode={state.repeatMode}
              track={state.currentTrack ?? MOBILE_DEMO_LIBRARY.nowPlaying.track}
            />
            <BottomTabBar
              activeTab={activeTab}
              onChange={setActiveTab}
              tabs={navTabs}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: mobileTheme.colors.screen,
  },
  screen: {
    flex: 1,
    backgroundColor: mobileTheme.colors.screen,
  },
  glowTop: {
    position: "absolute",
    top: -120,
    right: -90,
    width: 320,
    height: 320,
    borderRadius: 320,
    backgroundColor: "rgba(143, 248, 241, 0.14)",
  },
  glowBottom: {
    position: "absolute",
    left: -140,
    bottom: 90,
    width: 360,
    height: 360,
    borderRadius: 360,
    backgroundColor: "rgba(255, 179, 138, 0.10)",
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 190,
  },
  contentInner: {
    width: "100%",
    maxWidth: 1240,
    alignSelf: "center",
    gap: 18,
  },
  header: {
    gap: 18,
    padding: 22,
    borderRadius: mobileTheme.radius.card,
    backgroundColor: mobileTheme.colors.surface,
    borderWidth: 1,
    borderColor: mobileTheme.colors.outline,
  },
  headerStack: {
    flexDirection: "column",
  },
  headerWide: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerCopy: {
    flex: 1,
    gap: 10,
  },
  headerPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  kicker: {
    color: mobileTheme.colors.mint,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  title: {
    color: mobileTheme.colors.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    maxWidth: 720,
  },
  description: {
    color: mobileTheme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 720,
  },
  heroGrid: {
    gap: 16,
  },
  heroGridStack: {
    flexDirection: "column",
  },
  heroGridWide: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  heroCard: {
    flex: 1.2,
    padding: 22,
    borderRadius: mobileTheme.radius.card,
    backgroundColor: mobileTheme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: mobileTheme.colors.outlineStrong,
    gap: 12,
  },
  heroEyebrow: {
    color: mobileTheme.colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: mobileTheme.colors.text,
    fontSize: 28,
    fontWeight: "900",
  },
  heroSubtitle: {
    color: mobileTheme.colors.textMuted,
    fontSize: 15,
    fontWeight: "600",
  },
  heroBody: {
    color: mobileTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  heroPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  progressTrack: {
    height: 8,
    borderRadius: mobileTheme.radius.pill,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
  },
  progressFill: {
    width: "37%",
    height: "100%",
    borderRadius: mobileTheme.radius.pill,
    backgroundColor: mobileTheme.colors.mint,
  },
  metricSection: {
    flex: 1,
    padding: 20,
    borderRadius: mobileTheme.radius.card,
    backgroundColor: mobileTheme.colors.surface,
    borderWidth: 1,
    borderColor: mobileTheme.colors.outline,
    gap: 14,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  section: {
    padding: 20,
    borderRadius: mobileTheme.radius.card,
    backgroundColor: mobileTheme.colors.surface,
    borderWidth: 1,
    borderColor: mobileTheme.colors.outline,
    gap: 14,
  },
  horizontalRail: {
    gap: 12,
  },
  supportGrid: {
    gap: 16,
  },
  supportGridStack: {
    flexDirection: "column",
  },
  supportGridWide: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  trackList: {
    gap: 2,
  },
  cardStack: {
    gap: 12,
  },
  promptStack: {
    gap: 10,
  },
  promptCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: mobileTheme.radius.compact,
    backgroundColor: mobileTheme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: mobileTheme.colors.outline,
  },
  promptTitle: {
    color: mobileTheme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  bottomChrome: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
  },
  bottomChromeInner: {
    width: "100%",
    maxWidth: 1240,
    alignSelf: "center",
    gap: 10,
  },
});
