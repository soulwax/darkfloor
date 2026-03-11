import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const cookieStore = await cookies();
  const requestHeaders = await headers();

  const cookieLocale = normalizeLocale(cookieStore.get("NEXT_LOCALE")?.value);
  const acceptedLocale = normalizeLocale(requestHeaders.get("accept-language"));
  const requestedLocale = normalizeLocale(await requestLocale);

  const locale =
    cookieLocale ??
    requestedLocale ??
    acceptedLocale ??
    routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});

function normalizeLocale(
  value: string | undefined | null,
): (typeof routing.locales)[number] | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.toLowerCase().split(",")[0]?.split("-")[0];
  if (!normalized) {
    return undefined;
  }

  if (routing.locales.includes(normalized as (typeof routing.locales)[number])) {
    return normalized as (typeof routing.locales)[number];
  }

  return undefined;
}
