// File: apps/web/src/i18n/request.ts

import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

type MessagesModule = {
  default: Record<string, unknown>;
};

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
