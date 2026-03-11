import { defineRouting } from "next-intl/routing";

export const locales = ["en", "de", "sv", "ja"] as const;
export type AppLocale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "en",
  localePrefix: "never",
});
