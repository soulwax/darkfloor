// File: apps/web/src/app/songbird/auth-me/page.tsx

"use client";

import { useSongbirdAuthMe } from "@/hooks/useSongbirdAuthMe";

export default function SongbirdAuthMePage() {
  const { data, error, isLoading, refetch } = useSongbirdAuthMe();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-4 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">
            Songbird Auth Me
          </h1>
          <p className="text-sm text-[var(--color-subtext)]">
            Data source: <code>GET /api/auth/me</code>
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void refetch();
          }}
          className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
        >
          Refresh
        </button>
      </header>

      {isLoading ? (
        <p className="text-sm text-[var(--color-subtext)]">Loading...</p>
      ) : null}

      {error ? (
        <pre className="overflow-auto rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-200">
          {JSON.stringify(error, null, 2)}
        </pre>
      ) : (
        <pre className="overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 text-xs text-[var(--color-text)]">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </main>
  );
}
