# Electron Setup for darkfloor.art

## What Was

The error "ReferenceError: process is not defined in ES module scope" occurred because:

1. Your `package.json` has `"type": "module"`, making all `.js` files ES modules
2. Electron's main process file was missing or incorrectly configured

## Solution Applied

1. Created `electron/main.cjs` - Main process file using CommonJS (`.cjs` extension explicitly marks it as CommonJS, avoiding ES module conflicts)
2. Created `electron/preload.cjs` - Preload script for secure renderer communication
3. Created `electron/types.d.ts` - TypeScript definitions for Electron API
4. Updated `package.json` to point to `main.cjs` instead of `main.js`

## What can

### Development

```bash
npm run electron:dev
```

This starts both the Next.js dev server and Electron, with hot reload enabled.

### Production Build

For Windows:

```bash
npm run electron:build:win
```

For macOS:

```bash
npm run electron:build:mac
```

For Linux:

```bash
npm run electron:build:linux
```

## Important Notes

### Packaged environment loading (automatic encrypted bundle)

`npm run electron:build*` now runs an automatic env prep step:

- Generates RSA keypair if missing (`certs/starchild-env-private.key`, `certs/starchild-env-public.pem`)
- Encrypts `.env.local` into `.next/standalone/.env.local.enc`
- Keeps plaintext `.env.local` out of `.next/standalone`
- Bundles the encrypted payload and key files with the app

At runtime, `electron/main.cjs` decrypts the bundled payload automatically.

Important: this is **obfuscation for UX convenience**, not strong secret protection, because the private key ships with the app and can be reverse engineered.

Disable auto encryption and use external env only:

```bash
ELECTRON_AUTO_ENCRYPT_ENV=false npm run electron:build:linux
```

### Recommended runtime env setup

Use one of these:

- `STARCHILD_ENV_FILE` environment variable pointing to an external env file.
- OS/service environment variables (systemd unit, Windows service/session env).

Linux example (`/etc/starchild/.env`):

```bash
API_V2_URL=https://bluesixapi.com/
BLUESIX_API_KEY=...
DATABASE_URL=...
AUTH_SECRET=...
AUTH_DISCORD_ID=...
AUTH_DISCORD_SECRET=...
```

Windows PowerShell example:

```powershell
$env:STARCHILD_ENV_FILE = "C:\ProgramData\Starchild\.env.local"
Start-Process "C:\Program Files\Starchild\Starchild.exe"
```

### Certificate-based encrypted env (built-in decryption)

The Electron main process can decrypt encrypted env payloads at startup.

Supported runtime variables:

- `STARCHILD_ENC_ENV_FILE`: path to encrypted env payload (`.enc`)
- `STARCHILD_ENV_PRIVATE_KEY_FILE`: path to RSA private key PEM
- `STARCHILD_ENV_PRIVATE_KEY_PASSPHRASE`: optional private key passphrase

Create keys/cert (example):

```bash
npm run env:keypair
```

Encrypt `.env.local`:

```bash
npm run env:encrypt -- --in .env.local --cert certs/starchild-env-public.pem --out /etc/starchild/.env.enc
```

Run app with built-in decryption:

```bash
STARCHILD_ENC_ENV_FILE=/etc/starchild/.env.enc \
STARCHILD_ENV_PRIVATE_KEY_FILE=/etc/starchild/.env.private.key \
./Starchild.AppImage
```

The app tries encrypted env files first, then plaintext env files.

### If the EXE “doesn’t start”

If double-clicking the app immediately exits (or prints Node help/version output), check for this environment variable:

- `ELECTRON_RUN_AS_NODE=1`

When set, **Electron runs as Node.js** and won’t launch the desktop UI. Unset it for normal app launches. The `electron:dev` / `electron:prod` npm scripts now explicitly clear it for the Electron process.

Runtime logs are written to `app.getPath("userData")/logs/electron-main.log` (on Windows this is typically under `%APPDATA%`).

### Static vs Server Mode

Next.js uses `standalone` mode for Electron. `ELECTRON_BUILD` is set automatically: build scripts set it for `next build` (image optimization), and the Electron main process sets it when spawning the Next server (NextAuth cookies).

**If you need server-side features (tRPC, API routes, SSR):**

- Keep standalone mode
- Use `npm run electron:build` (or electron:build:win etc.) so `ELECTRON_BUILD` is set for the build
- electron-builder `files` config includes `.next/standalone/**/*`

**If you want a simpler static build (no server-side features):**

- Change `next.config.js` output to `'export'`
- This creates static HTML in `out/` directory (which electron-builder expects)

### Next Steps

1. Rebuild your Electron app with the new configuration
2. Test the .exe - the error should be resolved
3. If using server features, update the build configuration as noted above

## Windows signing (self-signed)

Electron Builder is configured to sign Windows artifacts using a certificate with subject name `Starchild`.

- Create + trust a local self-signed code signing cert (CurrentUser): `npm run electron:sign:setup:win`
- Build signed artifacts: `npm run electron:build:win`
- Verify signature: `Get-AuthenticodeSignature dist\\Starchild.exe`

Note: self-signed certificates are only trusted on machines where you install them into the trust stores, and they don’t grant SmartScreen reputation for public distribution.

## File Structure

```sh
electron/
├── main.cjs       # Main process (CommonJS to avoid ES module issues)
├── preload.cjs    # Preload script for security
└── types.d.ts     # TypeScript definitions
```

## Security Notes

The preload script enables secure communication between Electron and your Next.js renderer:

- `contextIsolation: true` - Prevents renderer from directly accessing Node.js
- `sandbox: true` - Additional security layer
- Preload script exposes only specific, safe APIs to the renderer

## Accessing Electron APIs in Your Next.js Code

In your React components, you can access Electron APIs:

```typescript
// Check if running in Electron
if (typeof window !== 'undefined' && window.electron) {
  console.log('Platform:', window.electron.platform);
  
  // Send message to main process
  window.electron.send('toMain', { data: 'hello' });
  
  // Receive messages from main process
  window.electron.receive('fromMain', (data) => {
    console.log('Received:', data);
  });
}
```
