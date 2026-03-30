import type { JSX } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { RepeatMode, Track } from "@starchild/player-core";

import {
  createMonogram,
  formatTrackDuration,
  getAccentPalette,
  mobileTheme,
} from "./theme";
import type {
  MobileArtistSpotlight,
  MobileCollection,
  MobileMetric,
  MobileTabDefinition,
  MobileTabId,
} from "./types";

interface SectionHeadingProps {
  title: string;
  subtitle: string;
}

export function SectionHeading({
  title,
  subtitle,
}: SectionHeadingProps): JSX.Element {
  return (
    <View style={headingStyles.root}>
      <Text style={headingStyles.title}>{title}</Text>
      <Text style={headingStyles.subtitle}>{subtitle}</Text>
    </View>
  );
}

interface StatusPillProps {
  label: string;
  value: string;
}

export function StatusPill({ label, value }: StatusPillProps): JSX.Element {
  return (
    <View style={pillStyles.root}>
      <Text style={pillStyles.label}>{label}</Text>
      <Text style={pillStyles.value}>{value}</Text>
    </View>
  );
}

interface SearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
}

export function SearchField({
  value,
  onChangeText,
}: SearchFieldProps): JSX.Element {
  return (
    <View style={searchStyles.root}>
      <Text style={searchStyles.label}>Search the shared catalog</Text>
      <TextInput
        accessibilityLabel="Search the shared catalog"
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder="Track, artist, album, or release date"
        placeholderTextColor={mobileTheme.colors.textSubtle}
        selectionColor={mobileTheme.colors.mint}
        style={searchStyles.input}
        value={value}
      />
    </View>
  );
}

interface MetricCardProps {
  metric: MobileMetric;
}

export function MetricCard({ metric }: MetricCardProps): JSX.Element {
  return (
    <View style={metricStyles.root}>
      <Text style={metricStyles.label}>{metric.label}</Text>
      <Text style={metricStyles.value}>{metric.value}</Text>
      <Text style={metricStyles.hint}>{metric.hint}</Text>
    </View>
  );
}

interface TrackRowProps {
  track: Track;
  caption: string;
  tone: "blue" | "mint" | "coral" | "gold";
}

export function TrackRow({
  track,
  caption,
  tone,
}: TrackRowProps): JSX.Element {
  const palette = getAccentPalette(tone);

  return (
    <View style={trackStyles.row}>
      <View
        style={[
          trackStyles.cover,
          {
            backgroundColor: palette.background,
            borderColor: palette.border,
          },
        ]}
      >
        <Text style={[trackStyles.coverText, { color: palette.accent }]}>
          {createMonogram(track.title)}
        </Text>
      </View>

      <View style={trackStyles.copy}>
        <Text numberOfLines={1} style={trackStyles.title}>
          {track.title}
        </Text>
        <Text numberOfLines={1} style={trackStyles.subtitle}>
          {track.artist.name} • {caption}
        </Text>
      </View>

      <View style={trackStyles.meta}>
        <Text style={trackStyles.metaLabel}>
          {formatTrackDuration(track.duration)}
        </Text>
        <Text numberOfLines={1} style={trackStyles.metaHint}>
          {track.album.title}
        </Text>
      </View>
    </View>
  );
}

interface CollectionCardProps {
  collection: MobileCollection;
}

export function CollectionCard({
  collection,
}: CollectionCardProps): JSX.Element {
  const palette = getAccentPalette(collection.tone);

  return (
    <View
      style={[
        collectionStyles.root,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
        },
      ]}
    >
      <Text style={[collectionStyles.eyebrow, { color: palette.accent }]}>
        {collection.curator}
      </Text>
      <Text style={collectionStyles.title}>{collection.title}</Text>
      <Text style={collectionStyles.subtitle}>{collection.subtitle}</Text>
      <Text style={[collectionStyles.meta, { color: palette.text }]}>
        {collection.trackCount > 0
          ? `${collection.trackCount} tracks`
          : "Ready for wiring"}
      </Text>
    </View>
  );
}

interface ArtistCardProps {
  artist: MobileArtistSpotlight;
}

export function ArtistCard({ artist }: ArtistCardProps): JSX.Element {
  const palette = getAccentPalette(artist.tone);

  return (
    <View
      style={[
        artistStyles.root,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
        },
      ]}
    >
      <Text style={[artistStyles.badge, { color: palette.accent }]}>
        {artist.listenerLabel}
      </Text>
      <Text style={artistStyles.name}>{artist.name}</Text>
      <Text style={artistStyles.summary}>{artist.summary}</Text>
    </View>
  );
}

interface EmptyStateProps {
  title: string;
  body: string;
}

export function EmptyState({ title, body }: EmptyStateProps): JSX.Element {
  return (
    <View style={emptyStyles.root}>
      <Text style={emptyStyles.title}>{title}</Text>
      <Text style={emptyStyles.body}>{body}</Text>
    </View>
  );
}

interface NowPlayingDockProps {
  queueLength: number;
  repeatMode: RepeatMode;
  track: Track;
}

export function NowPlayingDock({
  queueLength,
  repeatMode,
  track,
}: NowPlayingDockProps): JSX.Element {
  return (
    <View style={dockStyles.root}>
      <View style={dockStyles.copy}>
        <Text numberOfLines={1} style={dockStyles.title}>
          {track.title}
        </Text>
        <Text numberOfLines={1} style={dockStyles.subtitle}>
          {track.artist.name} • {formatTrackDuration(track.duration)}
        </Text>
      </View>
      <View style={dockStyles.meta}>
        <Text style={dockStyles.metaLabel}>{queueLength} queued</Text>
        <Text style={dockStyles.metaValue}>repeat {repeatMode}</Text>
      </View>
    </View>
  );
}

interface BottomTabBarProps {
  activeTab: MobileTabId;
  onChange: (tabId: MobileTabId) => void;
  tabs: readonly MobileTabDefinition[];
}

export function BottomTabBar({
  activeTab,
  onChange,
  tabs,
}: BottomTabBarProps): JSX.Element {
  return (
    <View style={tabBarStyles.root}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;

        return (
          <Pressable
            accessibilityRole="button"
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={({ pressed }: { pressed: boolean }) => [
              tabBarStyles.tab,
              isActive ? tabBarStyles.tabActive : null,
              pressed ? tabBarStyles.tabPressed : null,
            ]}
          >
            <Text
              style={[
                tabBarStyles.caption,
                isActive ? tabBarStyles.captionActive : null,
              ]}
            >
              {tab.caption}
            </Text>
            <Text
              style={[
                tabBarStyles.label,
                isActive ? tabBarStyles.labelActive : null,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const headingStyles = StyleSheet.create({
  root: {
    gap: 4,
  },
  title: {
    color: mobileTheme.colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    color: mobileTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});

const pillStyles = StyleSheet.create({
  root: {
    minWidth: 128,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: mobileTheme.radius.compact,
    backgroundColor: mobileTheme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: mobileTheme.colors.outline,
    gap: 4,
  },
  label: {
    color: mobileTheme.colors.textSubtle,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  value: {
    color: mobileTheme.colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
});

const searchStyles = StyleSheet.create({
  root: {
    gap: 10,
    padding: 18,
    borderRadius: mobileTheme.radius.card,
    backgroundColor: mobileTheme.colors.surface,
    borderWidth: 1,
    borderColor: mobileTheme.colors.outline,
  },
  label: {
    color: mobileTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  input: {
    minHeight: 52,
    borderRadius: mobileTheme.radius.compact,
    backgroundColor: mobileTheme.colors.screenAlt,
    borderWidth: 1,
    borderColor: mobileTheme.colors.outline,
    paddingHorizontal: 16,
    color: mobileTheme.colors.text,
    fontSize: 16,
  },
});

const metricStyles = StyleSheet.create({
  root: {
    flex: 1,
    minWidth: 156,
    padding: 16,
    borderRadius: mobileTheme.radius.compact,
    backgroundColor: mobileTheme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: mobileTheme.colors.outline,
    gap: 6,
  },
  label: {
    color: mobileTheme.colors.textSubtle,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  value: {
    color: mobileTheme.colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  hint: {
    color: mobileTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});

const trackStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  cover: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  coverText: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: mobileTheme.colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  subtitle: {
    color: mobileTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  meta: {
    alignItems: "flex-end",
    gap: 3,
    maxWidth: 120,
  },
  metaLabel: {
    color: mobileTheme.colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  metaHint: {
    color: mobileTheme.colors.textSubtle,
    fontSize: 11,
    textAlign: "right",
  },
});

const collectionStyles = StyleSheet.create({
  root: {
    minWidth: 230,
    width: 230,
    padding: 18,
    borderRadius: mobileTheme.radius.section,
    borderWidth: 1,
    gap: 10,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  title: {
    color: mobileTheme.colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  subtitle: {
    color: mobileTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    fontSize: 13,
    fontWeight: "700",
  },
});

const artistStyles = StyleSheet.create({
  root: {
    padding: 18,
    borderRadius: mobileTheme.radius.section,
    borderWidth: 1,
    gap: 10,
  },
  badge: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  name: {
    color: mobileTheme.colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  summary: {
    color: mobileTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});

const emptyStyles = StyleSheet.create({
  root: {
    paddingVertical: 18,
    gap: 6,
  },
  title: {
    color: mobileTheme.colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  body: {
    color: mobileTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});

const dockStyles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: mobileTheme.radius.card,
    backgroundColor: mobileTheme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: mobileTheme.colors.outlineStrong,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: mobileTheme.colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  subtitle: {
    color: mobileTheme.colors.textMuted,
    fontSize: 13,
  },
  meta: {
    alignItems: "flex-end",
    gap: 4,
  },
  metaLabel: {
    color: mobileTheme.colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  metaValue: {
    color: mobileTheme.colors.mint,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});

const tabBarStyles = StyleSheet.create({
  root: {
    flexDirection: "row",
    gap: 10,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: mobileTheme.radius.compact,
    backgroundColor: mobileTheme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: mobileTheme.colors.outline,
    gap: 2,
  },
  tabActive: {
    backgroundColor: "rgba(143, 248, 241, 0.12)",
    borderColor: "rgba(143, 248, 241, 0.26)",
  },
  tabPressed: {
    opacity: 0.8,
  },
  caption: {
    color: mobileTheme.colors.textSubtle,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  captionActive: {
    color: mobileTheme.colors.mintDeep,
  },
  label: {
    color: mobileTheme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  labelActive: {
    color: mobileTheme.colors.mint,
  },
});
