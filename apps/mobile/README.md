# apps/mobile

Mobile shell workspace for future React Native / Expo implementation.

Current scope:
- Provides a typed shell entrypoint under `src/index.ts`
- Consumes shared monorepo packages (`@starchild/types`, `@starchild/config`, `@starchild/player-core`)
- Exposes placeholder scripts so workspace pipelines can include mobile without affecting web/desktop runtime

Not included yet:
- React Native runtime
- Expo configuration
- Native build/deploy setup
