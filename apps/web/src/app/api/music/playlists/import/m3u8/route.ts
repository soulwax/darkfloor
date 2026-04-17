// File: apps/web/src/app/api/music/playlists/import/m3u8/route.ts

import { proxyApiV2 } from "@/app/api/v2/_lib";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

const M3U8_IMPORT_PROXY_TIMEOUT_MS = 90_000;

const m3u8ImportRequestSchema = z.object({
  content: z.string().min(1),
  sourcePlaylistId: z.string().trim().min(1).optional(),
  sourcePlaylistName: z.string().trim().min(1).optional(),
  playlistName: z.string().trim().min(1).optional(),
  descriptionOverride: z.string().trim().min(1).optional(),
  createPlaylist: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return NextResponse.json(
      { ok: false, error: "Backend authorization is required." },
      { status: 401 },
    );
  }

  let payload: z.infer<typeof m3u8ImportRequestSchema>;

  try {
    payload = m3u8ImportRequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "A valid M3U/M3U8 playlist import payload is required.",
      },
      { status: 400 },
    );
  }

  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: authorization,
  });

  const sourcePlaylistName =
    payload.sourcePlaylistName ?? payload.playlistName ?? "Imported M3U8";

  const upstreamRequest = new Request(request.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      content: payload.content,
      sourcePlaylistId: payload.sourcePlaylistId ?? sourcePlaylistName,
      sourcePlaylistName,
      playlistName: payload.playlistName ?? sourcePlaylistName,
      descriptionOverride: payload.descriptionOverride,
      createPlaylist: payload.createPlaylist ?? false,
      isPublic: payload.isPublic,
    }),
  });

  return proxyApiV2({
    pathname: "/music/playlists/import/m3u8",
    request: upstreamRequest,
    method: "POST",
    timeoutMs: M3U8_IMPORT_PROXY_TIMEOUT_MS,
  });
}
