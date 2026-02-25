// File: apps/web/src/app/artist/[id]/loading.tsx

export default function ArtistLoading() {
  return (
    <div className="container mx-auto px-3 py-4 md:px-6 md:py-8">
      {/* Header row */}
      <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:gap-6">
        {/* Circle image placeholder */}
        <div className="flex-shrink-0">
          <div className="aspect-square w-full max-w-[200px] animate-pulse rounded-full bg-[rgba(255,255,255,0.08)] md:max-w-[300px]" />
        </div>

        {/* Info placeholder */}
        <div className="flex flex-1 flex-col justify-end gap-3">
          <div className="h-3 w-12 animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
          <div className="h-9 w-56 animate-pulse rounded-lg bg-[rgba(255,255,255,0.1)]" />
          <div className="h-3 w-32 animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
          <div className="flex gap-3 pt-1">
            <div className="h-10 w-24 animate-pulse rounded-full bg-[rgba(244,178,102,0.2)]" />
            <div className="h-10 w-28 animate-pulse rounded-full bg-[rgba(255,255,255,0.06)]" />
          </div>
        </div>
      </div>

      {/* Track list placeholder */}
      <div className="mb-4 h-5 w-36 animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-4"
          >
            <div className="h-20 w-20 flex-shrink-0 animate-pulse rounded-xl bg-[rgba(255,255,255,0.08)]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/5 animate-pulse rounded bg-[rgba(255,255,255,0.1)]" />
              <div className="h-3 w-2/5 animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-[rgba(255,255,255,0.05)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
