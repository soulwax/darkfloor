import type { JSX } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { createInitialMobileShellState, MOBILE_SHELL_INFO } from "./src";

const FEATURE_PANELS = [
  {
    eyebrow: "Playback",
    title: "Shared player state",
    body: "The mobile runtime reads the same queue, repeat-mode, and visualizer contracts as the web and desktop apps.",
  },
  {
    eyebrow: "Platform",
    title: "React Native Web-first",
    body: "Expo drives the runtime so this app can ship on the web now and grow into iOS and Android without a rebuild of the architecture.",
  },
  {
    eyebrow: "Monorepo",
    title: "Typed package reuse",
    body: "Shared imports stay inside the existing @starchild package boundaries instead of crossing into app-local code.",
  },
] as const;

const initialState = createInitialMobileShellState();

export default function App(): JSX.Element {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>Starchild Mobile</Text>
          <Text style={styles.title}>React Native Web now lives inside the monorepo.</Text>
          <Text style={styles.description}>
            This Expo-powered app is the mobile-facing runtime for shared playback primitives, music metadata, and future native delivery.
          </Text>
          <View style={styles.metricsRow}>
            <MetricCard label="Platform" value={Platform.OS} />
            <MetricCard label="Repeat Mode" value={initialState.repeatMode} />
            <MetricCard label="Visualizer Modes" value={String(MOBILE_SHELL_INFO.supportedVisualizerTypes.length)} />
          </View>
        </View>

        <View style={styles.panelGrid}>
          {FEATURE_PANELS.map((panel) => (
            <View key={panel.title} style={styles.panel}>
              <Text style={styles.panelEyebrow}>{panel.eyebrow}</Text>
              <Text style={styles.panelTitle}>{panel.title}</Text>
              <Text style={styles.panelBody}>{panel.body}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shared runtime contracts</Text>
          <View style={styles.definitionList}>
            <DefinitionRow label="Queue state key" value={MOBILE_SHELL_INFO.sharedStorageKeys.queueState} />
            <DefinitionRow label="Volume key" value={MOBILE_SHELL_INFO.sharedStorageKeys.volume} />
            <DefinitionRow
              label="Spotify playlist sync"
              value={MOBILE_SHELL_INFO.spotifyFeatureDefaults.playlistImportEnabled ? "enabled" : "disabled"}
            />
          </View>
        </View>

        <Pressable accessibilityRole="button" style={styles.primaryAction}>
          <Text style={styles.primaryActionText}>Ready for shared player integration</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
}

function MetricCard({ label, value }: MetricCardProps): JSX.Element {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

interface DefinitionRowProps {
  label: string;
  value: string;
}

function DefinitionRow({ label, value }: DefinitionRowProps): JSX.Element {
  return (
    <View style={styles.definitionRow}>
      <Text style={styles.definitionLabel}>{label}</Text>
      <Text style={styles.definitionValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#08111f",
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 28,
    gap: 24,
    backgroundColor: "#08111f",
  },
  hero: {
    gap: 16,
    padding: 24,
    borderRadius: 28,
    backgroundColor: "#101f35",
    borderWidth: 1,
    borderColor: "#213759",
    shadowColor: "#020611",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },
  },
  kicker: {
    color: "#8dd6ff",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    color: "#f3f7ff",
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    maxWidth: 640,
  },
  description: {
    color: "#c1d2eb",
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 720,
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricCard: {
    minWidth: 160,
    flexGrow: 1,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#0b1728",
    borderWidth: 1,
    borderColor: "#233750",
    gap: 6,
  },
  metricLabel: {
    color: "#9eb4d2",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  metricValue: {
    color: "#f3f7ff",
    fontSize: 24,
    fontWeight: "700",
  },
  panelGrid: {
    gap: 14,
  },
  panel: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: "#0d1829",
    borderWidth: 1,
    borderColor: "#1d314e",
    gap: 8,
  },
  panelEyebrow: {
    color: "#7ad4c0",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  panelTitle: {
    color: "#eff6ff",
    fontSize: 22,
    fontWeight: "700",
  },
  panelBody: {
    color: "#b9cce6",
    fontSize: 15,
    lineHeight: 22,
  },
  section: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: "#0d1829",
    borderWidth: 1,
    borderColor: "#1d314e",
    gap: 12,
  },
  sectionTitle: {
    color: "#eff6ff",
    fontSize: 20,
    fontWeight: "700",
  },
  definitionList: {
    gap: 10,
  },
  definitionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 6,
  },
  definitionLabel: {
    color: "#8ea6c7",
    fontSize: 14,
    fontWeight: "600",
  },
  definitionValue: {
    color: "#f2f7ff",
    fontSize: 14,
    fontWeight: "700",
  },
  primaryAction: {
    alignSelf: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: "#9efcff",
  },
  primaryActionText: {
    color: "#06202a",
    fontSize: 15,
    fontWeight: "800",
  },
});
