// File: packages/api-client/src/trpc/react.tsx

"use client";

import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { httpBatchStreamLink, loggerLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import SuperJSON from "superjson";

import {
  ImportSpotifyPlaylistError,
  type ImportSpotifyPlaylistInput,
  type ImportSpotifyPlaylistResponse,
  type ImportSpotifyPlaylistUnmatchedReason,
  useImportSpotifyPlaylistMutation,
} from "./music-import";
import { type AppRouter } from "./router";
import { createQueryClient } from "./query-client";

let clientQueryClientSingleton: QueryClient | undefined = undefined;
const getQueryClient = () => {
  if (typeof window === "undefined") {

    return createQueryClient();
  }

  clientQueryClientSingleton ??= createQueryClient();

  return clientQueryClientSingleton;
};

const trpcApi = createTRPCReact<AppRouter>();

type ApiWithSpotifyImportMutation = typeof trpcApi & {
  music: typeof trpcApi.music & {
    importSpotifyPlaylist: {
      useMutation: typeof useImportSpotifyPlaylistMutation;
    };
  };
};

const spotifyImportMutationApi = {
  useMutation: useImportSpotifyPlaylistMutation,
} as const;

const musicApi = new Proxy(trpcApi.music as object, {
  get(target, prop, receiver): unknown {
    if (prop === "importSpotifyPlaylist") {
      return spotifyImportMutationApi;
    }

    return Reflect.get(target, prop, receiver) as unknown;
  },
}) as ApiWithSpotifyImportMutation["music"];

export const api = new Proxy(trpcApi as object, {
  get(target, prop, receiver): unknown {
    if (prop === "music") {
      return musicApi;
    }

    return Reflect.get(target, prop, receiver) as unknown;
  },
}) as ApiWithSpotifyImportMutation;

export type RouterInputs = inferRouterInputs<AppRouter>;

export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type {
  ImportSpotifyPlaylistInput,
  ImportSpotifyPlaylistResponse,
  ImportSpotifyPlaylistUnmatchedReason,
};
export { ImportSpotifyPlaylistError };

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    trpcApi.createClient({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        httpBatchStreamLink({
          transformer: SuperJSON,
          url: getBaseUrl() + "/api/trpc",
          headers: () => {
            const headers = new Headers();
            headers.set("x-trpc-source", "nextjs-react");
            return headers;
          },
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <trpcApi.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
      </trpcApi.Provider>
    </QueryClientProvider>
  );
}

function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
