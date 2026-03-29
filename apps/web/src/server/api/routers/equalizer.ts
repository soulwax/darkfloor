// File: apps/web/src/server/api/routers/equalizer.ts

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { z } from "zod";

const EqualizerBandSchema = z.number().min(-12).max(12);

export const equalizerRouter = createTRPCRouter({

  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const preferences = await ctx.dataStore.userPreferences.getEqualizerByUserId(
      ctx.session.user.id,
    );

    if (!preferences) {
      return {
        enabled: false,
        preset: "Flat",
        bands: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      };
    }

    return {
      enabled: preferences.enabled,
      preset: preferences.preset,
      bands:
        preferences.bands.length > 0
          ? preferences.bands
          : [0, 0, 0, 0, 0, 0, 0, 0, 0],
    };
  }),

  updatePreferences: protectedProcedure
    .input(
      z.object({
        enabled: z.boolean().optional(),
        preset: z.string().optional(),
        bands: z.array(EqualizerBandSchema).length(9).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.dataStore.userPreferences.upsertEqualizerByUserId(
        ctx.session.user.id,
        {
          enabled: input.enabled,
          preset: input.preset,
          bands: input.bands,
        },
      );
    }),

  applyPreset: protectedProcedure
    .input(
      z.object({
        preset: z.string(),
        bands: z.array(EqualizerBandSchema).length(9),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.dataStore.userPreferences.upsertEqualizerByUserId(
        ctx.session.user.id,
        {
          enabled: true,
          preset: input.preset,
          bands: input.bands,
        },
      );
    }),
});
