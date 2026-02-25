// File: packages/types/src/searchSuggestions.ts

export type SearchSuggestionType = "query" | "track" | "artist" | "album";

export interface SearchSuggestionItem {
  id: string;
  type: SearchSuggestionType;
  label: string;
  sublabel?: string;
  query: string;
  artwork?: string;
}
