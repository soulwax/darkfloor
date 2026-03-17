import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { SpotifyImportDialog } from "@/components/SpotifyImportDialog";

vi.mock("next-intl", () => ({
  useTranslations:
    (namespace: string) =>
    (key: string, values?: Record<string, unknown>) => {
      if (namespace === "spotify") {
        if (key === "importAmbiguousCandidatesTitle") {
          return "Deezer suggestions";
        }
        if (key === "importAmbiguousCandidatesShow") {
          return `Show ${String(values?.count ?? 0)} similar Deezer tracks`;
        }
        if (key === "importAmbiguousCandidatesHide") {
          return `Hide ${String(values?.count ?? 0)} similar Deezer tracks`;
        }
        if (key === "importCandidateMatchScore") {
          return `${String(values?.score ?? 0)}% match`;
        }
        if (key === "openTrackOnDeezer") {
          return `Open ${String(values?.title ?? "")} on Deezer`;
        }
      }

      if (namespace === "common") {
        if (key === "unknownArtist") return "Unknown artist";
        if (key === "unknownAlbum") return "Unknown album";
      }

      return key;
    },
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: ReactNode;
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("SpotifyImportDialog ambiguous candidates", () => {
  it("expands ambiguous tracks into deezer suggestion cards", () => {
    render(
      <SpotifyImportDialog
        isOpen
        isSubmitting={false}
        playlist={{
          id: "spotify-playlist-1",
          name: "Spotify Playlist",
          description: "Playlist description",
          ownerName: "starchild",
          trackCount: 3,
          imageUrl: null,
        }}
        importError={null}
        importDiagnostics={null}
        importResult={{
          ok: true,
          playlist: {
            id: "321",
            name: "Imported Playlist",
          },
          importReport: {
            sourcePlaylistId: "spotify-playlist-1",
            sourcePlaylistName: "Spotify Playlist",
            totalTracks: 3,
            matchedCount: 2,
            unmatchedCount: 1,
            skippedCount: 1,
            unmatched: [
              {
                index: 1,
                spotifyTrackId: "spotify-track-2",
                name: "Midnight City - Live",
                artist: "M83",
                reason: "ambiguous",
                candidates: [
                  {
                    deezerTrackId: "601",
                    title: "Midnight City",
                    artist: "M83",
                    album: "Hurry Up, We Are Dreaming",
                    durationSeconds: 241,
                    score: 92,
                    link: "https://www.deezer.com/track/601",
                    coverImageUrl: "https://cdn.test/601.jpg",
                  },
                  {
                    deezerTrackId: "602",
                    title: "Midnight City (Live at Red Rocks)",
                    artist: "M83",
                    album: "Live in Denver",
                    durationSeconds: 244,
                    score: 90,
                    link: "https://www.deezer.com/track/602",
                    coverImageUrl: "https://cdn.test/602.jpg",
                  },
                ],
              },
            ],
          },
        }}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(
      screen.queryByText("Midnight City (Live at Red Rocks)"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Show 2 similar Deezer tracks/i,
      }),
    );

    expect(screen.getByText("Midnight City (Live at Red Rocks)")).toBeVisible();
    expect(screen.getByText("92% match")).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Open Midnight City on Deezer/i }),
    ).toHaveAttribute("href", "https://www.deezer.com/track/601");
  });
});
