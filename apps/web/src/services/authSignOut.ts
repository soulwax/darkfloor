// File: apps/web/src/services/authSignOut.ts

"use client";

import { signOut } from "next-auth/react";

import { clearSpotifyBrowserSessionArtifacts } from "@/services/spotifyAuthClient";

type AppSignOutOptions = {
  callbackUrl?: string;
};

export async function appSignOut(
  options: AppSignOutOptions = {},
): Promise<void> {
  clearSpotifyBrowserSessionArtifacts();
  await signOut({ callbackUrl: options.callbackUrl ?? "/" });
}
