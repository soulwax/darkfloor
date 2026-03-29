// File: apps/web/src/server/api/routers/preferences.ts

import { z } from "zod";

import { DEFAULT_EQUALIZER } from "@/config/audioDefaults";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

const SAFE_DEFAULTS = {
  preset: DEFAULT_EQUALIZER.preset,
  bands: [...DEFAULT_EQUALIZER.bands],
  enabled: DEFAULT_EQUALIZER.enabled,
};

export const preferencesRouter = createTRPCRouter({
  updateEqualizer: protectedProcedure
    .input(
      z.object({
        preset: z.string().min(1).default(SAFE_DEFAULTS.preset),
        bands: z
          .array(z.number().min(-12).max(12))
          .length(10)
          .default(SAFE_DEFAULTS.bands),
        enabled: z.boolean().default(SAFE_DEFAULTS.enabled),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.dataStore.userPreferences.upsertEqualizerByUserId(
        ctx.session.user.id,
        {
          preset: input.preset,
          bands: input.bands,
          enabled: input.enabled,
        },
      );
    }),

  getEqualizer: protectedProcedure.query(async ({ ctx }) => {
    const prefs = await ctx.dataStore.userPreferences.getEqualizerByUserId(
      ctx.session.user.id,
    );

    return prefs
      ? {
          preset: prefs.preset,
          bands: prefs.bands,
          enabled: prefs.enabled,
        }
      : SAFE_DEFAULTS;
  }),
});
