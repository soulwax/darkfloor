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
  runtime, but stages them into `apps/desktop/src-tauri/b/` instead of touching
  Electron packaging assets.
- Packaged Tauri builds prefer the bundled encrypted runtime env payload staged
  from `.env.local`. External overrides still work via `STARCHILD_ENV_FILE` or
  `STARCHILD_ENC_ENV_FILE`.
- On Windows, `pnpm tauri:all` now builds the NSIS bundle with `--no-sign` and
  then self-signs the generated Tauri executable and installer with a local
  code-signing leaf certificate issued from `certs/ca.pem` and `certs/ca.key`.
- This Windows signing path is free and useful for local or internal
  distribution, but it is not publicly trusted like a commercial code-signing
  certificate. Other machines would need to trust the local CA manually.
- Rust is required for Tauri builds. This repo does not auto-install Rust.
