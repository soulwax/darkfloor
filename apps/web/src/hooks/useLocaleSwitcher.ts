"use client";

import { locales, type AppLocale } from "@/i18n/routing";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useTransition } from "react";

interface LocaleOption {
  label: string;
  value: AppLocale;
}

export function useLocaleSwitcher() {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("common");
  const [isPending, startTransition] = useTransition();

  const options = useMemo<LocaleOption[]>(
    () =>
      locales.map((value) => ({
        value,
        label: t(`languages.${value}`),
      })),
    [t],
  );

  const setLocale = (nextLocale: AppLocale) => {
    if (nextLocale === locale) {
      return;
    }

    document.cookie = `NEXT_LOCALE=${nextLocale}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;

    const query = searchParams.toString();
    const href = query ? `${pathname}?${query}` : pathname;

    startTransition(() => {
      router.replace(href);
      router.refresh();
    });
  };

  return {
    isPending,
    locale,
    options,
    setLocale,
  };
}
