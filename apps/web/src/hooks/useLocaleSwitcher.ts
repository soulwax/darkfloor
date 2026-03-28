// File: apps/web/src/hooks/useLocaleSwitcher.ts

"use client";

import { locales, type AppLocale } from "@/i18n/routing";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useTransition } from "react";

interface LocaleOption {
  label: string;
  value: AppLocale;
}

const LOCALE_STORAGE_KEY = "starchild_locale";

function persistLocaleInBrowser(locale: AppLocale): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch (error) {
    console.error("Failed to persist locale to localStorage:", error);
  }

  try {
    sessionStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch (error) {
    console.error("Failed to persist locale to sessionStorage:", error);
  }
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

  const setLocale = useCallback(
    (nextLocale: AppLocale) => {
      if (nextLocale === locale) {
        return;
      }

      document.cookie = `NEXT_LOCALE=${nextLocale}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      persistLocaleInBrowser(nextLocale);

      const query = searchParams.toString();
      const href = query ? `${pathname}?${query}` : pathname;

      startTransition(() => {
        router.replace(href);
      });
    },
    [locale, pathname, router, searchParams, startTransition],
  );

  return {
    isPending,
    locale,
    options,
    setLocale,
  };
}
