// File: apps/web/src/utils/startOAuthSignIn.ts

import { logAuthClientDebug } from "@/utils/authDebugClient";
import { buildAuthCallbackUrl } from "@/utils/authRedirect";

type CsrfResponse = {
  csrfToken?: string;
};

function createHiddenInput(name: string, value: string): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = name;
  input.value = value;
  return input;
}

export async function prefetchOAuthCsrfToken(): Promise<string> {
  const response = await fetch("/api/auth/csrf", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch CSRF token (${response.status})`);
  }

  const payload = (await response.json()) as CsrfResponse;
  const csrfToken = payload.csrfToken?.trim();

  if (!csrfToken) {
    throw new Error("CSRF token missing from auth response");
  }

  return csrfToken;
}

export async function startOAuthSignIn(
  providerId: string,
  callbackUrl: string,
  prefetchedCsrfToken?: string | null,
): Promise<void> {
  const redirectUrl = buildAuthCallbackUrl(callbackUrl, providerId);

  logAuthClientDebug("Starting OAuth form-post flow", {
    providerId,
    callbackUrl,
    redirectUrl,
  });

  const trimmedPrefetchedCsrfToken = prefetchedCsrfToken?.trim();
  const csrfToken =
    trimmedPrefetchedCsrfToken && trimmedPrefetchedCsrfToken.length > 0
      ? trimmedPrefetchedCsrfToken
      : await prefetchOAuthCsrfToken();
  const form = document.createElement("form");
  form.method = "POST";
  form.action = `/api/auth/signin/${providerId}`;
  form.style.display = "none";
  form.appendChild(createHiddenInput("csrfToken", csrfToken));
  form.appendChild(createHiddenInput("callbackUrl", redirectUrl));

  document.body.appendChild(form);
  form.submit();
}
