// File: apps/web/src/__tests__/SpotifyImportDialog.test.tsx

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SpotifyImportDialog } from "@/components/SpotifyImportDialog";
import type { SearchResponse } from "@starchild/types";

const { searchTracksMock } = vi.hoisted(() => ({
  searchTracksMock: vi.fn(),
}));

function toDisplayString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

vi.mock("@starchild/api-client/rest", () => ({
  searchTracks: searchTracksMock,
}));

vi.mock("next-intl", () => ({
  useTranslations:
    (namespace: string) =>
    (key: string, values?: Record<string, unknown>) => {
      if (namespace === "spotify") {
        if (key === "importWizardContinue") {
          return "Continue";
        }
        if (key === "importWizardBack") {
          return "Back";
        }
        if (key === "importWizardStepReview") {
          return "Review source";
        }
        if (key === "importWizardStepReviewDescription") {
          return "Check the Spotify playlist you're about to convert.";
        }
        if (key === "importWizardStepDestination") {
          return "Set destination";
        }
        if (key === "importWizardStepDestinationDescription") {
          return "Choose the Starchild playlist name and visibility.";
        }
        if (key === "importWizardStepConfirm") {
          return "Convert";
        }
        if (key === "importWizardStepConfirmDescription") {
          return "Review the conversion summary, then start the import.";
        }
        if (key === "importWizardConfirmTitle") {
          return "Ready to create your Starchild playlist";
        }
        if (key === "importAmbiguousCandidatesTitle") {
          return "Deezer suggestions";
        }
        if (key === "importAmbiguousCandidatesShow") {
          return `Show ${toDisplayString(values?.count ?? 0)} similar Deezer tracks`;
        }
        if (key === "importAmbiguousCandidatesHide") {
          return `Hide ${toDisplayString(values?.count ?? 0)} similar Deezer tracks`;
        }
        if (key === "importCandidateMatchScore") {
          return `${toDisplayString(values?.score ?? 0)}% match`;
        }
        if (key === "openTrackOnDeezer") {
          return `Open ${toDisplayString(values?.title ?? "")} on Deezer`;
        }
        if (key === "importAlternativeSearchTitle") {
          return "Search alternatives";
        }
        if (key === "importAlternativeSearchShow") {
          return "Search Deezer alternatives for this track";
        }
        if (key === "importAlternativeSearchHide") {
          return "Hide Deezer alternative search";
        }
        if (key === "importAlternativeSearchPlaceholder") {
          return "Search title, artist, or album";
        }
        if (key === "importAlternativeSearchAction") {
          return "Search Deezer";
        }
        if (key === "importAlternativeSearchSearching") {
          return "Searching Deezer...";
        }
        if (key === "importAlternativeSearchHint") {
          return "Try a different title, featured artist, or album version if the first results miss.";
        }
        if (key === "importAlternativeSearchResultsTitle") {
          return `${toDisplayString(values?.count ?? 0)} alternatives found`;
        }
        if (key === "importAlternativeSearchNoResults") {
          return "No Deezer alternatives matched that search yet.";
        }
        if (key === "importAlternativeSearchEmpty") {
          return "Enter a title or artist before searching for alternatives.";
        }
        if (key === "importAlternativeSearchFailed") {
          return "We couldn't search Deezer right now. Try again in a moment.";
        }
        if (key === "openTrackInStarchild") {
          return `Open ${toDisplayString(values?.title ?? "")} in Starchild`;
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
  beforeEach(() => {
    searchTracksMock.mockReset();
  });

  it("searches deezer alternatives for unresolved tracks", async () => {
    const searchResponse: SearchResponse = {
      data: [
        {
          id: 991,
          readable: true,
          title: "Power of Night",
          title_short: "Power of Night",
          link: "https://www.deezer.com/track/991",
          duration: 248,
          rank: 999,
          explicit_lyrics: false,
          explicit_content_lyrics: 0,
          explicit_content_cover: 0,
          preview: "https://cdn.test/preview-991.mp3",
          md5_image: "cover991",
          artist: {
            id: 88,
            name: "Starchild",
            type: "artist",
          },
          album: {
            id: 77,
            title: "Darkfloor Nights",
            cover: "https://cdn.test/991-cover.jpg",
            cover_small: "https://cdn.test/991-cover-small.jpg",
            cover_medium: "https://cdn.test/991-cover-medium.jpg",
            cover_big: "https://cdn.test/991-cover-big.jpg",
            cover_xl: "https://cdn.test/991-cover-xl.jpg",
            md5_image: "album991",
            tracklist: "https://api.test/albums/77/tracks",
            type: "album",
          },
          type: "track",
        },
      ],
      total: 1,
    };
    searchTracksMock.mockResolvedValueOnce(searchResponse);

    render(
      <SpotifyImportDialog
        isOpen
        isSubmitting={false}
        playlist={{
          id: "spotify-playlist-2",
          name: "Spotify Playlist",
          description: "Playlist description",
          ownerName: "starchild",
          trackCount: 1,
          imageUrl: null,
        }}
        importError={null}
        importDiagnostics={null}
        importResult={{
          ok: true,
          playlist: {
            id: "322",
            name: "Imported Playlist",
          },
          importReport: {
            sourcePlaylistId: "spotify-playlist-2",
            sourcePlaylistName: "Spotify Playlist",
            totalTracks: 1,
            matchedCount: 0,
            unmatchedCount: 1,
            skippedCount: 0,
            unmatched: [
              {
                index: 0,
                spotifyTrackId: "spotify-track-3",
                name: "Power of Night",
                artist: "Starchild",
                reason: "not_found",
              },
            ],
          },
        }}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /Search Deezer alternatives for this track/i,
      }),
    );

    expect(searchTracksMock).toHaveBeenCalledWith("Starchild Power of Night", 0);
    expect(await screen.findByText("Darkfloor Nights")).toBeVisible();
    expect(screen.getByText("1 alternatives found")).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Open Power of Night in Starchild/i }),
    ).toHaveAttribute("href", "/track/991");
  });

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

  it("guides the user through the wizard before submitting the import", () => {
    const onSubmit = vi.fn();

    render(
      <SpotifyImportDialog
        isOpen
        isSubmitting={false}
        playlist={{
          id: "spotify-playlist-wizard",
          name: "Night Drive",
          description: "Late-night synths",
          ownerName: "starchild",
          trackCount: 14,
          imageUrl: null,
        }}
        importError={null}
        importDiagnostics={null}
        importResult={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /Continue/i,
      }),
    );

    const playlistNameInput = screen.getByDisplayValue("Night Drive");
    fireEvent.change(playlistNameInput, {
      target: { value: "Night Drive Converted" },
    });

    fireEvent.click(screen.getByLabelText("makePublic"));
    fireEvent.click(
      screen.getByRole("button", {
        name: /Continue/i,
      }),
    );

    expect(
      screen.getByText("Ready to create your Starchild playlist"),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", {
        name: /importToStarchild/i,
      }),
    );

    expect(onSubmit).toHaveBeenCalledWith({
      spotifyPlaylistId: "spotify-playlist-wizard",
      nameOverride: "Night Drive Converted",
      isPublic: true,
    });
  });
});
