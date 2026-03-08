# Spotify Playlist Import

Last updated: 2026-03-08

## Summary

The best first elevated-consent Spotify perk for Starchild is:

`Import Spotify playlist -> translate tracks to Deezer -> save as a normal Starchild playlist`

This remains a strong feature, but it is no longer part of basic Spotify login. Backend Spotify OAuth was narrowed to profile login only, so playlist import now needs a separate elevated-consent flow.

The feature should treat Spotify as a read source and the local Starchild playlist as the canonical playback object.

## Scope caveat

Basic Spotify login now defaults to:

- `user-read-email`
- `user-read-private`

That means the current login flow should only be used for account connection and profile identity. Frontend must not assume playlist, library, top-track, or recently-played access immediately after login.

This document therefore describes a future elevated-consent flow for playlist import, not the default post-login capability set.

## Why this should be first

- Users instantly understand it.
- It is the highest-value feature once the user grants elevated Spotify consent.
- It turns Spotify taste/history into something playable in the Starchild frontend.
- It reuses the app's existing playlist, playback, and Deezer track infrastructure.
- It avoids promising true sync before the matching and review experience is mature.

## User-facing value

### MVP perks

- Browse the user's Spotify playlists inside the Starchild frontend.
- Import any Spotify playlist into a local playlist.
- Auto-match as many Spotify tracks as possible to Deezer tracks.
- Show match rate before saving.
- Surface unmatched tracks explicitly instead of dropping them silently.
- Preserve Spotify source metadata so the import can be reviewed or re-run later.

### Phase 2 perks

- Import `Liked Songs` as a synthetic playlist.
- Import `Recently Played` as a temporary queue or saved playlist.
- Re-import a previously imported playlist and only add new matches.
- Show `Imported from Spotify` badges and source links.
- Allow manual fixing of unmatched tracks and remember overrides.

## Non-goals for v1

- Two-way sync with Spotify.
- Editing Spotify playlists from Starchild.
- Background auto-sync.
- Collaborative sync.
- Hiding low-confidence matches from the user.

## Product spec

### Entry points

- `Settings > Connections > Spotify`: account state, elevated-consent request, import history, and re-import.
- `Library` page: primary `Import from Spotify` CTA.
- `Playlists` page: secondary `Import from Spotify` CTA.

### Primary flow

1. User starts from an already connected basic Spotify account.
2. User explicitly grants elevated Spotify playlist consent.
3. User clicks `Import from Spotify`.
4. Frontend loads the user's Spotify playlists from a local proxy route.
5. User selects a playlist.
6. Frontend loads playlist details and runs an import preview.
7. Preview shows:
   - playlist artwork, name, owner, track count
   - matched track count
   - low-confidence track count
   - unmatched track count
8. User chooses:
   - `Import matched tracks`
   - `Review low-confidence matches`
   - `Cancel`
9. App creates a normal local playlist and inserts matched Deezer tracks.
10. Success screen shows:

- local playlist link
- match summary
- unresolved track count
- optional `Review unresolved tracks`

### Review flow

If any tracks are unresolved or below the auto-import threshold:

- Show Spotify track metadata beside proposed Deezer matches.
- Allow:
  - accept suggested match
  - search manually
  - skip track
- Save manual corrections as reusable overrides.

### Re-import flow

If the same Spotify playlist was imported before:

- Show `Re-import` instead of `Import`.
- Diff against the previous snapshot.
- Default behavior:
  - add newly matched tracks
  - keep existing local playlist order stable
  - do not remove local-only edits in v1

## Recommended architecture

### Ownership rules

- Spotify remains an upstream read source.
- Local playlist playback remains owned by this repo's DB:
  - `playlists`
  - `playlistTracks`
- Imported source metadata is stored separately so the local playlist remains editable and playable even if Spotify is unavailable later.

### Frontend/runtime split

Use the existing repo conventions:

- Next.js route handlers for upstream transport.
- tRPC mutations for app-owned DB writes.

### Recommended route surface

Add local proxy routes for Spotify reads:

- `GET /api/spotify/playlists`
  - proxies upstream `GET /spotify/playlists`
  - only valid after elevated Spotify playlist consent
- `GET /api/spotify/playlists/[playlistId]`
  - proxies upstream `GET /spotify/playlists/{playlistId}`
  - only valid after elevated Spotify playlist consent

Optional later:

- `GET /api/spotify/liked-songs`
- `GET /api/spotify/recently-played`

### Recommended tRPC surface

Add app-owned mutations/queries in `music` router:

- `music.previewSpotifyPlaylistImport`
- `music.importSpotifyPlaylist`
- `music.getSpotifyImportHistory`
- `music.resolveSpotifyImportItemMatch`

The key design decision:

- Read Spotify through route handlers.
- Write local playlists through tRPC.

This keeps upstream transport and local DB ownership cleanly separated.

### Why not rely on upstream `/spotify/playlists/import` first

The upstream swagger already exposes `POST /spotify/playlists/import`, but the local app owns the playlist tables and user-facing playlist UX.

Use the upstream playlist endpoints as the source of Spotify data first. Only delegate the full import write path upstream if the write target is explicitly the same playlist system and DB contract.

## Matching and translation

### Matching pipeline

For each Spotify track:

1. Exact match by `ISRC` if available.
2. Exact match by normalized:
   - title
   - primary artist
   - duration window
3. Fuzzy match by normalized title + artist.
4. Fallback search through the existing music search/conversion services.
5. Mark unresolved if confidence stays below threshold.

### Normalization rules

Normalize before matching:

- lowercase
- remove punctuation noise
- collapse whitespace
- strip common suffixes when comparing:
  - `remaster`
  - `remastered`
  - `deluxe`
  - `live`
  - `radio edit`
  - `explicit`
  - `clean`
  - `mono`
  - `stereo`
- preserve the original raw title for display

### Confidence scoring

Recommended initial thresholds:

- `>= 0.97`
  - auto-import
- `0.85 - 0.96`
  - importable, but flagged as low-confidence in preview
- `< 0.85`
  - unresolved, requires user review or skip

Suggested scoring rules:

- ISRC exact match: `1.00`
- title exact + artist exact + duration within 2s: `0.97`
- normalized title exact + artist exact + duration within 5s: `0.93`
- normalized title fuzzy + artist exact: `0.88`
- title exact + artist fuzzy: `0.86`
- anything weaker: unresolved

### What should be stored on imported tracks

When a Spotify track is successfully matched and inserted into `playlistTracks`:

- store the Deezer track as normal `trackData`
- include `spotify_id` on the stored track payload when available
- keep source provenance in import metadata tables instead of overloading the playlist row

This aligns with the existing shared `Track` type, which already supports `spotify_id`.

## Data model

### Existing tables reused as-is

- `users`
- `playlists`
- `playlistTracks`

These remain the canonical playback model.

### New table: `external_playlist_import`

Purpose:

- one row per import or re-import run
- links a Spotify source playlist to a local playlist snapshot

Suggested columns:

| Column                 | Type                                    | Notes                                        |
| ---------------------- | --------------------------------------- | -------------------------------------------- |
| `id`                   | `integer` PK                            | local import id                              |
| `userId`               | `varchar` FK -> `users.id`              | owner                                        |
| `provider`             | `varchar(32)`                           | start with `spotify`                         |
| `providerPlaylistId`   | `varchar(255)`                          | Spotify playlist id                          |
| `providerPlaylistUrl`  | `varchar(512)` nullable                 | source URL                                   |
| `providerPlaylistName` | `varchar(256)`                          | source name at import time                   |
| `providerOwnerName`    | `varchar(256)` nullable                 | playlist owner label                         |
| `providerSnapshotId`   | `varchar(255)` nullable                 | Spotify snapshot/version if available        |
| `localPlaylistId`      | `integer` FK -> `playlists.id` nullable | created local playlist                       |
| `status`               | `varchar(32)`                           | `previewed`, `imported`, `partial`, `failed` |
| `totalTracks`          | `integer`                               | source total                                 |
| `matchedTracks`        | `integer`                               | imported matches                             |
| `lowConfidenceTracks`  | `integer`                               | reviewable matches                           |
| `unmatchedTracks`      | `integer`                               | unresolved count                             |
| `createdAt`            | `timestamp`                             | run started                                  |
| `completedAt`          | `timestamp` nullable                    | run finished                                 |
| `lastError`            | `text` nullable                         | import failure summary                       |
| `rawSourcePayload`     | `jsonb` nullable                        | optional compact playlist metadata snapshot  |

Suggested indexes:

- `(userId, provider, providerPlaylistId)`
- `(localPlaylistId)`
- `(createdAt desc)`

### New table: `external_playlist_import_item`

Purpose:

- one row per source Spotify track in an import run
- stores match outcome, confidence, and manual decisions

Suggested columns:

| Column                  | Type                                          | Notes                                                                  |
| ----------------------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| `id`                    | `integer` PK                                  | local item id                                                          |
| `importId`              | `integer` FK -> `external_playlist_import.id` | parent run                                                             |
| `sourcePosition`        | `integer`                                     | order inside Spotify playlist                                          |
| `providerTrackId`       | `varchar(255)` nullable                       | Spotify track id                                                       |
| `providerTrackName`     | `varchar(512)`                                | raw Spotify title                                                      |
| `providerArtistName`    | `varchar(512)` nullable                       | flattened primary artist                                               |
| `providerAlbumName`     | `varchar(512)` nullable                       | album label                                                            |
| `providerDurationMs`    | `integer` nullable                            | Spotify duration                                                       |
| `providerIsrc`          | `varchar(32)` nullable                        | best exact-match key                                                   |
| `matchStatus`           | `varchar(32)`                                 | `matched`, `low_confidence`, `unmatched`, `skipped`, `manual_override` |
| `matchMethod`           | `varchar(32)` nullable                        | `isrc`, `metadata_exact`, `metadata_fuzzy`, `manual`                   |
| `matchConfidence`       | `numeric(5,4)` nullable                       | `0.0000` to `1.0000`                                                   |
| `deezerTrackId`         | `bigint` nullable                             | matched Deezer id                                                      |
| `playlistTrackId`       | `integer` FK -> `playlistTracks.id` nullable  | inserted local playlist row                                            |
| `rawSourceTrackPayload` | `jsonb` nullable                              | compact Spotify track snapshot                                         |
| `rawMatchPayload`       | `jsonb` nullable                              | candidate/matcher snapshot                                             |
| `createdAt`             | `timestamp`                                   | item created                                                           |
| `updatedAt`             | `timestamp` nullable                          | review/update time                                                     |

Suggested indexes:

- `(importId, sourcePosition)`
- `(providerTrackId)`
- `(deezerTrackId)`
- `(matchStatus)`

### New table: `external_track_match_override`

Purpose:

- remember manual Spotify -> Deezer choices across future imports

Suggested columns:

| Column                | Type                       | Notes                                              |
| --------------------- | -------------------------- | -------------------------------------------------- |
| `id`                  | `integer` PK               | local override id                                  |
| `userId`              | `varchar` FK -> `users.id` | owner                                              |
| `provider`            | `varchar(32)`              | `spotify`                                          |
| `providerTrackId`     | `varchar(255)` nullable    | preferred stable key                               |
| `providerIsrc`        | `varchar(32)` nullable     | fallback exact key                                 |
| `providerFingerprint` | `varchar(512)`             | normalized `artist + title + duration` fingerprint |
| `deezerTrackId`       | `bigint`                   | chosen Deezer track                                |
| `reason`              | `varchar(64)` nullable     | `manual_review`, `preferred_version`, etc.         |
| `createdAt`           | `timestamp`                | created time                                       |
| `updatedAt`           | `timestamp` nullable       | last touched                                       |

Suggested indexes:

- `(userId, provider, providerTrackId)`
- `(userId, provider, providerIsrc)`
- `(userId, provider, providerFingerprint)`

### Intentional omission in v1

Do not add a continuous sync table yet.

Why:

- It adds scheduler, deletion, and conflict semantics before the import UX is proven.
- A run-based import model is easier to reason about and easier to support.

## Recommended API contracts

### `music.previewSpotifyPlaylistImport`

Input:

```ts
{
  playlistId: string;
}
```

Output:

```ts
{
  source: {
    provider: "spotify";
    playlistId: string;
    name: string;
    imageUrl: string | null;
    ownerName: string | null;
    trackCount: number;
  }
  summary: {
    total: number;
    matched: number;
    lowConfidence: number;
    unmatched: number;
  }
  items: Array<{
    sourcePosition: number;
    spotifyTrackId: string | null;
    title: string;
    artist: string | null;
    durationMs: number | null;
    matchStatus: "matched" | "low_confidence" | "unmatched";
    matchConfidence: number | null;
    deezerTrack: Track | null;
  }>;
}
```

### `music.importSpotifyPlaylist`

Input:

```ts
{
  playlistId: string;
  playlistName?: string;
  description?: string;
  isPublic?: boolean;
  selectedItems?: Array<{
    sourcePosition: number;
    deezerTrackId: number;
  }>;
}
```

If `selectedItems` is omitted, import all auto-approved matches.

Output:

```ts
{
  importId: number;
  localPlaylistId: number;
  importedCount: number;
  unresolvedCount: number;
  lowConfidenceCount: number;
}
```

### `music.resolveSpotifyImportItemMatch`

Input:

```ts
{
  importItemId: number;
  deezerTrackId: number;
  applyAsOverride?: boolean;
}
```

Output:

```ts
{
  success: true;
  playlistTrackId: number | null;
}
```

## UX details that matter

### Naming

Do not call this `Spotify sync` in v1.

Do not position this as part of the default Spotify login flow either. The consent expansion should be explicit and separate.

Use:

- `Import from Spotify`
- `Convert playlist`
- `Imported from Spotify`

Avoid:

- `Sync Spotify playlist`
- `Mirror Spotify`

### User trust

Never silently hide failures.

Always show:

- how many tracks matched
- how many did not
- whether any were low confidence

### Playlist ownership

After import, the local playlist is editable like any other Starchild playlist.

That is a feature, not a compromise.

## Rollout plan

### Phase 1

- Spotify playlist browser
- import preview
- auto-import matched tracks
- unresolved track list
- source metadata persistence

### Phase 2

- manual review and override save
- re-import existing playlist
- liked songs import

### Phase 3

- recently played continuation
- taste profile page from Spotify data
- cross-service recommendation entry points

## Success criteria

The feature is successful if:

- users can import a playlist in under 30 seconds
- median match rate is above 80 percent for normal playlists
- unresolved tracks are visible and fixable
- imported playlists behave exactly like native local playlists during playback

## Recommended first implementation slice

Build this in the smallest useful vertical slice:

1. local proxy route for `GET /api/spotify/playlists`
2. local proxy route for `GET /api/spotify/playlists/[playlistId]`
3. elevated-consent CTA and state in `Settings > Connections > Spotify`
4. `music.previewSpotifyPlaylistImport`
5. `music.importSpotifyPlaylist`
6. import modal on `Library` page
7. import history row in `Settings > Connections > Spotify`

That slice is enough to prove the value before building full review and re-import tooling.
