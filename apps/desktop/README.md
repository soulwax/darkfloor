# apps/desktop

Desktop runtime and packaging assets.

- Main process: `apps/desktop/electron/main.cjs`
- Preload script: `apps/desktop/electron/preload.cjs`
- Build helpers: `apps/desktop/scripts/*`
- Experimental Tauri shell: `apps/desktop/src-tauri`

## Electron

The existing Electron runtime remains the primary desktop shell and its build
scripts are unchanged.

## Experimental Tauri

The Tauri setup is intentionally parallel and opt-in:

- Dev shell: `pnpm tauri:dev`
- Bundle prep only: `pnpm tauri:prepare`
- Native build: `pnpm tauri:build`

Notes:

- The Tauri build reuses the existing Next standalone output and bundled Node
  runtime, but stages them into `apps/desktop/.tauri-bundle/` instead of
  touching Electron packaging assets.
- Packaged Tauri builds load env values from `STARCHILD_ENV_FILE`, then from
  `.env` / `.env.local` next to the executable or current working directory.
- Rust is required for Tauri builds. This repo does not auto-install Rust.
