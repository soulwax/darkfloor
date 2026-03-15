// File: apps/web/src/services/authSignOut.ts

"use client";

import { signOut } from "next-auth/react";

import { clearSpotifyBrowserSessionArtifacts } from "@/services/spotifyAuthClient";
import { spotifyFeatureSettingsStorage } from "@/utils/spotifyFeatureSettings";

type AppSignOutOptions = {
  callbackUrl?: string;
};

export async function appSignOut(
  options: AppSignOutOptions = {},
): Promise<void> {
  clearSpotifyBrowserSessionArtifacts();
  spotifyFeatureSettingsStorage.clear();
  await signOut({ callbackUrl: options.callbackUrl ?? "/" });
}
