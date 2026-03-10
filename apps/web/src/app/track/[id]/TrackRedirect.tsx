// File: apps/web/src/app/track/[id]/TrackRedirect.tsx

"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type TrackRedirectProps = {
  id: string;
};

export function TrackRedirect({ id }: TrackRedirectProps) {
  const t = useTranslations("trackRedirect");
  const router = useRouter();
  const params = new URLSearchParams();
  params.set("track", id);
  const destination = `/?${params.toString()}`;

  useEffect(() => {
    router.replace(destination);
  }, [destination, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">
        {t("openingTrack")}
      </h1>
      <p className="text-sm text-slate-300">
        {t("notRedirectedPrefix")}{" "}
        <Link className="text-orange-300 underline" href={destination}>
          {t("trackPlayerLink")}
        </Link>
        .
      </p>
    </main>
  );
}
