// File: apps/web/src/hooks/useSongbirdResource.ts

"use client";

import { useCallback, useEffect, useState } from "react";

type UnknownRecord = Record<string, unknown>;

export type SongbirdUiError = {
  ok: false;
  status: number;
  message: string;
  details?: unknown;
};

export type SongbirdResourceResult<T> = {
  data: T | null;
  error: SongbirdUiError | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
};

function asRecord(value: unknown): UnknownRecord | null {
  if (typeof value !== "object" || value === null) return null;
  return value as UnknownRecord;
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload.trim();
  }

  const record = asRecord(payload);
  if (!record) return fallback;

  if (typeof record.message === "string" && record.message.trim().length > 0) {
    return record.message;
  }

  if (typeof record.error === "string" && record.error.trim().length > 0) {
    return record.error;
  }

  return fallback;
}

async function parsePayload(response: Response): Promise<unknown> {
  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as unknown;
  }

  return await response.text();
}

export function useSongbirdResource<T>(path: string): SongbirdResourceResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<SongbirdUiError | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchResource = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch(path, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });

      const payload = await parsePayload(response);

      if (!response.ok) {
        const fallback = `Request failed with status ${response.status}`;
        const message = getErrorMessage(payload, fallback);
        setError({
          ok: false,
          status: response.status,
          message,
          ...(payload === null || payload === undefined || payload === ""
            ? {}
            : { details: payload }),
        });
        setData(null);
        return;
      }

      setData(payload as T);
      setError(null);
    } catch (fetchError) {
      setError({
        ok: false,
        status: 0,
        message:
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to fetch Songbird resource",
      });
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void fetchResource();
  }, [fetchResource]);

  return {
    data,
    error,
    isLoading,
    refetch: fetchResource,
  };
}
