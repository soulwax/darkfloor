// File: apps/web/src/i18n/request.ts

import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

type MessagesModule = {
  default: Record<string, unknown>;
};

export default getRequestConfig(async ({ requestLocale }) => {
  // cookies() / headers() require a live request context (workStore).
  // During static prerender of internal Next.js pages (e.g. /_global-error)
  // that context does not exist, so we fall back to undefined gracefully.
  let cookieLocale: (typeof routing.locales)[number] | undefined = undefined;

  try {
    const cookieStore = await cookies();
    cookieLocale = normalizeLocale(cookieStore.get("NEXT_LOCALE")?.value);
  } catch {
    // no request context — static prerender path
  }

  const requestedLocale = normalizeLocale(await requestLocale);

  const locale =
    cookieLocale ??
    requestedLocale ??
    routing.defaultLocale;
  const messagesModule = await loadMessages(locale);

  return {
    locale,
    messages: messagesModule.default,
  };
});

async function loadMessages(
  locale: (typeof routing.locales)[number],
): Promise<MessagesModule> {
  const messagesModule = (await import(
    `../../messages/${locale}.json`
  )) as unknown;

  if (!isMessagesModule(messagesModule)) {
    throw new Error(`Invalid messages module for locale "${locale}"`);
  }

  return messagesModule;
}

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

function isMessagesModule(value: unknown): value is MessagesModule {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.default === "object" && record.default !== null;
}
