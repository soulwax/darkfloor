// File: apps/web/src/utils/authProvidersFallback.ts

import {
  ENABLED_OAUTH_PROVIDER_IDS,
  getOAuthProviderDisplayName,
} from "@/config/oauthProviders";
import type { getProviders } from "next-auth/react";

type ProvidersResponse = NonNullable<Awaited<ReturnType<typeof getProviders>>>;
type ProviderRecord = ProvidersResponse[string];

const buildOAuthProvider = (id: (typeof ENABLED_OAUTH_PROVIDER_IDS)[number]): ProviderRecord => ({
  id,
  name: getOAuthProviderDisplayName(id),
  type: "oauth",
  signinUrl: `/api/auth/signin/${id}`,
  callbackUrl: `/api/auth/callback/${id}`,
  redirectTo: "/",
});

export const OAUTH_PROVIDERS_FALLBACK: ProvidersResponse = Object.fromEntries(
  ENABLED_OAUTH_PROVIDER_IDS.map((id) => [id, buildOAuthProvider(id)]),
) as ProvidersResponse;
