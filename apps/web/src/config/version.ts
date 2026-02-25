// File: apps/web/src/config/version.ts

import { env } from "@/env";

export const APP_VERSION: string =
  env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
