// File: apps/desktop/electron/main.cjs

const path = require("path");
const fs = require("fs");
const os = require("os");
const electron = require("electron");
const { app } = electron;
const repoRoot = path.resolve(__dirname, "../../..");
const webPublicDir = path.join(repoRoot, "apps", "web", "public");

/**
 * @typedef {Object} WindowState
 * @property {number} width
 * @property {number} height
 * @property {number} [x]
 * @property {number} [y]
 * @property {boolean} isMaximized
 */

/**
 * @typedef {"light" | "dark"} ThemeSource
 */

/**
 * @typedef {Object} WindowMinimizePayload
 * @property {"window:minimize"} type
 */

/**
 * @typedef {Object} WindowClosePayload
 * @property {"window:close"} type
 */

/**
 * @typedef {Object} WindowToggleMaximizePayload
 * @property {"window:toggleMaximize"} type
 */

/**
 * @typedef {Object} WindowGetStatePayload
 * @property {"window:getState"} type
 */

/**
 * @typedef {Object} TitlebarOverlaySetPayload
 * @property {"titlebarOverlay:set"} type
 * @property {string} [color]
 * @property {string} [symbolColor]
 * @property {number} [height]
 * @property {ThemeSource} [theme]
 */

/**
 * @typedef {WindowMinimizePayload | WindowClosePayload | WindowToggleMaximizePayload | WindowGetStatePayload | TitlebarOverlaySetPayload} WindowIpcMessage
 */

/** @type {string[]} */
const bufferedLogLines = [];
const ENV_PAYLOAD_VERSION = 1;
const ENV_PAYLOAD_ALGORITHM = "aes-256-gcm+rsa-oaep-sha256";

/**
 * @param {unknown} arg
 * @returns {string}
 */
const formatLogArg = (arg) => {
  if (arg instanceof Error) return arg.stack || arg.message;
  if (typeof arg === "string") return arg;
  if (typeof arg === "number" || typeof arg === "boolean" || arg == null) {
    return String(arg);
  }
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
};

/**
 * Log before the file logger is initialized. Buffers output for later flush.
 * @param  {...any} args
 */
/**
 * @param {...unknown} args
 */
const bootLog = (...args) => {
  const timestamp = new Date().toISOString();
  const message = args.map(formatLogArg).join(" ");
  bufferedLogLines.push(`[${timestamp}] [Electron] ${message}`);
  try {
    console.log("[Electron]", ...args);
  } catch {}
};

/**
 * @param {string} value
 * @returns {Buffer}
 */
const decodeBase64 = (value) => Buffer.from(value, "base64");

/**
 * @param {string} envText
 * @param {import("dotenv")} dotenv
 * @returns {number}
 */
const applyParsedEnv = (envText, dotenv) => {
  const parsed = dotenv.parse(envText);
  let applied = 0;
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] !== undefined) continue;
    process.env[key] = value;
    applied += 1;
  }
  return applied;
};

/**
 * @param {string} envFilePath
 * @param {string} keyFilePath
 * @param {string | undefined} passphrase
 * @returns {string}
 */
const decryptEnvPayload = (envFilePath, keyFilePath, passphrase) => {
  const crypto = require("crypto");
  const payloadRaw = fs.readFileSync(envFilePath, "utf8");
  const payload = JSON.parse(payloadRaw);

  if (!payload || typeof payload !== "object") {
    throw new Error("Encrypted env payload is not a valid JSON object");
  }

  const record = /** @type {Record<string, unknown>} */ (payload);
  const version = record.version;
  const algorithm = record.algorithm;
  const encryptedKey = record.encryptedKey;
  const iv = record.iv;
  const tag = record.tag;
  const ciphertext = record.ciphertext;

  if (version !== ENV_PAYLOAD_VERSION) {
    throw new Error(`Unsupported encrypted env version: ${String(version)}`);
  }
  if (algorithm !== ENV_PAYLOAD_ALGORITHM) {
    throw new Error(
      `Unsupported encrypted env algorithm: ${String(algorithm)}`,
    );
  }
  if (
    typeof encryptedKey !== "string" ||
    typeof iv !== "string" ||
    typeof tag !== "string" ||
    typeof ciphertext !== "string"
  ) {
    throw new Error("Encrypted env payload is missing required fields");
  }

  const privateKeyPem = fs.readFileSync(keyFilePath, "utf8");
  const privateKey = crypto.createPrivateKey({
    key: privateKeyPem,
    format: "pem",
    ...(passphrase ? { passphrase } : {}),
  });

  const symmetricKey = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    decodeBase64(encryptedKey),
  );

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    symmetricKey,
    decodeBase64(iv),
  );
  decipher.setAuthTag(decodeBase64(tag));

  const plaintext = Buffer.concat([
    decipher.update(decodeBase64(ciphertext)),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
};

try {
  const dotenv = require("dotenv");

  const isPackagedRuntime = app?.isPackaged === true;
  const packagedStandaloneDirs = [
    path.join(path.dirname(process.execPath), ".next", "standalone"),
    process.resourcesPath
      ? path.join(process.resourcesPath, ".next", "standalone")
      : undefined,
  ].filter(Boolean);
  const packagedEncryptedEnvPaths = packagedStandaloneDirs.flatMap(
    (standaloneDir) => [
      path.join(standaloneDir, ".env.local.enc"),
      path.join(standaloneDir, ".env.enc"),
    ],
  );
  const packagedPrivateKeyPaths = packagedStandaloneDirs.flatMap(
    (standaloneDir) => [
      path.join(standaloneDir, "certs", "starchild-env-private.key"),
      path.join(standaloneDir, ".env.private.key"),
    ],
  );
  const userConfigDir = (() => {
    if (process.platform === "win32") {
      return process.env.APPDATA
        ? path.join(process.env.APPDATA, "Starchild")
        : path.join(os.homedir(), "AppData", "Roaming", "Starchild");
    }
    if (process.platform === "darwin") {
      return path.join(
        os.homedir(),
        "Library",
        "Application Support",
        "Starchild",
      );
    }
    const xdgConfigHome =
      process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
    return path.join(xdgConfigHome, "starchild");
  })();

  const externalEnvPaths = [
    process.env.STARCHILD_ENV_FILE,
    path.join(path.dirname(process.execPath), ".env.local"),
    path.join(path.dirname(process.execPath), ".env"),
    path.join(userConfigDir, ".env.local"),
    path.join(userConfigDir, ".env"),
    process.platform === "linux" ? "/etc/starchild/.env" : undefined,
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), ".env"),
  ].filter(Boolean);

  const externalEncryptedEnvPaths = [
    process.env.STARCHILD_ENC_ENV_FILE,
    path.join(path.dirname(process.execPath), ".env.local.enc"),
    path.join(path.dirname(process.execPath), ".env.enc"),
    path.join(userConfigDir, ".env.local.enc"),
    path.join(userConfigDir, ".env.enc"),
    process.platform === "linux" ? "/etc/starchild/.env.enc" : undefined,
    path.join(process.cwd(), ".env.local.enc"),
    path.join(process.cwd(), ".env.enc"),
  ].filter(Boolean);

  const externalKeyPaths = [
    process.env.STARCHILD_ENV_PRIVATE_KEY_FILE,
    path.join(path.dirname(process.execPath), ".env.private.key"),
    path.join(path.dirname(process.execPath), "starchild-env-private.key"),
    path.join(userConfigDir, ".env.private.key"),
    path.join(userConfigDir, "starchild-env-private.key"),
    process.platform === "linux"
      ? "/etc/starchild/.env.private.key"
      : undefined,
    path.join(process.cwd(), ".env.private.key"),
  ].filter(Boolean);

  const devEnvPaths = [
    ...externalEnvPaths,
    path.join(
      path.dirname(process.execPath),
      ".next",
      "standalone",
      ".env.local",
    ),
    process.resourcesPath
      ? path.join(process.resourcesPath, ".next", "standalone", ".env.local")
      : undefined,
    path.resolve(repoRoot, ".env.local"),
    path.resolve(repoRoot, ".next/standalone/.env.local"),
  ].filter(Boolean);

  const devEncryptedEnvPaths = [
    ...externalEncryptedEnvPaths,
    path.resolve(repoRoot, ".env.local.enc"),
    path.resolve(repoRoot, ".env.enc"),
    path.resolve(repoRoot, ".next/standalone/.env.local.enc"),
  ].filter(Boolean);

  const devKeyPaths = [
    ...externalKeyPaths,
    path.resolve(repoRoot, ".env.private.key"),
    path.resolve(repoRoot, "certs/starchild-env-private.key"),
  ].filter(Boolean);

  const candidateEnvPaths = isPackagedRuntime ? externalEnvPaths : devEnvPaths;
  const candidateEncryptedEnvPaths = isPackagedRuntime
    ? [...externalEncryptedEnvPaths, ...packagedEncryptedEnvPaths]
    : devEncryptedEnvPaths;
  const candidatePrivateKeyPaths = isPackagedRuntime
    ? [...externalKeyPaths, ...packagedPrivateKeyPaths]
    : devKeyPaths;
  const privateKeyPassphrase = process.env.STARCHILD_ENV_PRIVATE_KEY_PASSPHRASE;

  let loaded = false;
  for (const envPath of candidateEncryptedEnvPaths) {
    if (!envPath || !fs.existsSync(envPath)) continue;

    const keyPaths = candidatePrivateKeyPaths.filter(
      (candidateKeyPath) =>
        typeof candidateKeyPath === "string" && fs.existsSync(candidateKeyPath),
    );
    if (keyPaths.length === 0) {
      bootLog(
        "Encrypted env found but no private key file was found. Set STARCHILD_ENV_PRIVATE_KEY_FILE.",
      );
      continue;
    }

    for (const keyPath of keyPaths) {
      try {
        const decryptedEnv = decryptEnvPayload(
          envPath,
          keyPath,
          privateKeyPassphrase,
        );
        const appliedCount = applyParsedEnv(decryptedEnv, dotenv);
        bootLog(
          "Loaded encrypted env from:",
          envPath,
          "using key:",
          keyPath,
          `(applied ${appliedCount} vars)`,
        );
        loaded = true;
        break;
      } catch (decryptError) {
        bootLog(
          "Failed to decrypt env payload with key:",
          envPath,
          keyPath,
          decryptError,
        );
      }
    }

    if (loaded) {
      break;
    }
  }

  if (!loaded) {
    for (const envPath of candidateEnvPaths) {
      if (envPath && fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
        bootLog("Loaded env from:", envPath);
        loaded = true;
        break;
      }
    }
  }

  if (!loaded) {
    if (isPackagedRuntime) {
      bootLog(
        "No external env file found - using system environment variables",
      );
      bootLog("Checked env paths:", candidateEnvPaths.join(", "));
    } else {
      bootLog("No .env.local found - using system environment variables");
    }
  }
} catch (err) {
  bootLog("dotenv not available (using system environment variables)", err);
}

bootLog("Environment check:");
bootLog("  NODE_ENV:", process.env.NODE_ENV || "not set");
bootLog("  PORT:", process.env.PORT || "not set");
bootLog(
  "  AUTH_SECRET:",
  process.env.AUTH_SECRET
    ? "✓ set (" + process.env.AUTH_SECRET.length + " chars)"
    : "✗ MISSING",
);
bootLog(
  "  AUTH_DISCORD_ID:",
  process.env.AUTH_DISCORD_ID ? "✓ set" : "✗ MISSING",
);
bootLog(
  "  AUTH_DISCORD_SECRET:",
  process.env.AUTH_DISCORD_SECRET ? "✓ set" : "✗ MISSING",
);
bootLog("  DATABASE_URL:", process.env.DATABASE_URL ? "✓ set" : "✗ MISSING");
bootLog(
  "  NEXTAUTH_URL:",
  process.env.NEXTAUTH_URL || "not set (using default)",
);

const {
  BrowserWindow,
  Menu,
  globalShortcut,
  dialog,
  screen,
  session,
  ipcMain,
  nativeTheme,
  shell,
} = electron;
const { spawn } = require("child_process");
const http = require("http");

/** @type {boolean} */
const isDev = !app.isPackaged && process.env.ELECTRON_PROD !== "true";
/** @type {boolean} */
const enableDevTools = isDev || process.env.ELECTRON_DEV_TOOLS === "true";
/** @type {number} */
const port = parseInt(process.env.PORT || "3222", 10);
/** @type {Set<string>} */
const loopbackOriginHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Resolve the loopback hostname used by Electron and the bundled Next server.
 * Priority:
 * 1) explicit ELECTRON_LOOPBACK_HOST
 * 2) localhost (consistent for OAuth providers)
 * @returns {string}
 */
const resolveLoopbackHost = () => {
  const explicitHost = (process.env.ELECTRON_LOOPBACK_HOST || "").trim();
  if (explicitHost) return explicitHost;

  // Always use localhost for Electron to ensure OAuth callbacks work correctly
  // OAuth providers like Discord expect the exact redirect_uri match
  return "localhost";
};
/** @type {string} */
const loopbackHost = resolveLoopbackHost();
bootLog("  ELECTRON_LOOPBACK_HOST (resolved):", loopbackHost);

/**
 * @param {URL} url
 * @returns {boolean}
 */
const isLoopbackUrl = (url) => {
  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    loopbackOriginHosts.has(url.hostname)
  );
};

/**
 * Treat localhost/127.0.0.1/::1 as equivalent app origins on the same port.
 * This keeps OAuth callbacks in-app even if a provider returns a different
 * loopback hostname variant than the one currently loaded.
 * @param {URL} target
 * @param {URL} appUrl
 * @returns {boolean}
 */
const isEquivalentLoopbackOrigin = (target, appUrl) => {
  return (
    isLoopbackUrl(target) &&
    isLoopbackUrl(appUrl) &&
    target.protocol === appUrl.protocol &&
    target.port === appUrl.port
  );
};

/** @type {Set<string>} */
const oauthNavigationHosts = new Set([
  "discord.com",
  "www.discord.com",
  "discordapp.com",
  "www.discordapp.com",
  "accounts.spotify.com",
  "challenge.spotify.com",
  "login5.spotify.com",
  "login.spotify.com",
]);

/**
 * Allow provider-hosted OAuth pages to stay inside Electron so callback cookies
 * are written to the app session instead of the external browser.
 * @param {string} rawUrl
 * @returns {boolean}
 */
const isAllowedOAuthNavigation = (rawUrl) => {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;
    return oauthNavigationHosts.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
};

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {import('child_process').ChildProcess | null} */
let serverProcess = null;

/**
 * @typedef {Object} ServerProcessState
 * @property {boolean} startupSettled
 * @property {boolean} serverExited
 * @property {string} stderrTail
 * @property {string} stdoutTail
 */

/**
 * @typedef {Object} ServerSpawnOptions
 * @property {NodeJS.ProcessEnv} env
 * @property {string} cwd
 * @property {import('child_process').StdioOptions} stdio
 */

/**
 * @typedef {Object} WindowOpenHandlerResult
 * @property {"allow" | "deny"} action
 * @property {import('electron').BrowserWindowConstructorOptions} [overrideBrowserWindowOptions]
 */

/** @returns {void} */
const publishWindowState = () => {
  if (!mainWindow) return;

  try {
    mainWindow.webContents.send("fromMain", {
      type: "windowState",
      isMaximized: mainWindow.isMaximized(),
    });
  } catch {
    // best-effort
  }
};

if (process.platform === "win32") {
  try {
    app.setAppUserModelId("com.darkfloor.art");
  } catch {
    // best-effort
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  bootLog("Another instance is already running - exiting");
  app.exit(0);
  process.exit(0);
}

/** @type {string} */
const windowStateFile = path.join(app.getPath("userData"), "window-state.json");

/** @type {string} */
const logDir = path.join(app.getPath("userData"), "logs");
/** @type {string} */
const logFile = path.join(logDir, "electron-main.log");

/**
 * @param {string} line
 * @returns {void}
 */
const appendLogLine = (line) => {
  try {
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(logFile, `${line}\n`, "utf8");
  } catch {}
};

for (const line of bufferedLogLines) {
  appendLogLine(line);
}
bufferedLogLines.length = 0;

/**
 * @param {...any} args
 */
/**
 * @param {...unknown} args
 * @returns {void}
 */
const log = (...args) => {
  const timestamp = new Date().toISOString();
  const message = args.map(formatLogArg).join(" ");
  appendLogLine(`[${timestamp}] [Electron] ${message}`);
  console.log("[Electron]", ...args);
};

/**
 * @returns {string | undefined}
 */
const getIconPath = () => {
  const candidates = [
    app.isPackaged
      ? path.join(
          path.dirname(process.execPath),
          ".next",
          "standalone",
          "public",
          "emily-the-strange.png",
        )
      : undefined,
    app.isPackaged
      ? path.join(
          path.dirname(process.execPath),
          ".next",
          "standalone",
          "public",
          "icon.png",
        )
      : undefined,
    process.resourcesPath
      ? path.join(
          process.resourcesPath,
          ".next",
          "standalone",
          "public",
          "emily-the-strange.png",
        )
      : undefined,
    process.resourcesPath
      ? path.join(
          process.resourcesPath,
          ".next",
          "standalone",
          "public",
          "icon.png",
        )
      : undefined,
    path.join(webPublicDir, "emily-the-strange.png"),
    path.join(webPublicDir, "icon.png"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }

  return undefined;
};

/**
 * Ensure the restored window bounds are on a visible display.
 * If the window would be off-screen (e.g. monitor removed), reset position.
 * @param {WindowState} state
 * @returns {WindowState}
 */
const ensureWindowStateIsVisible = (state) => {
  if (typeof state.x !== "number" || typeof state.y !== "number") return state;

  try {
    const bounds = {
      x: state.x,
      y: state.y,
      width: state.width,
      height: state.height,
    };

    const isVisible = screen.getAllDisplays().some((display) => {
      const wa = display.workArea;
      return (
        bounds.x < wa.x + wa.width &&
        bounds.x + bounds.width > wa.x &&
        bounds.y < wa.y + wa.height &&
        bounds.y + bounds.height > wa.y
      );
    });

    if (isVisible) return state;
  } catch (err) {
    log("Failed to validate window bounds:", err);
    return state;
  }

  log("Window state was off-screen; resetting position");
  return {
    width: state.width,
    height: state.height,
    isMaximized: false,
  };
};

/**
 * Load saved window state
 * @returns {WindowState}
 */
const loadWindowState = () => {
  try {
    if (fs.existsSync(windowStateFile)) {
      const data = fs.readFileSync(windowStateFile, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    log("Failed to load window state:", err);
  }

  return {
    width: 1200,
    height: 800,
    isMaximized: false,
  };
};

/**
 * Save current window state
 * @param {BrowserWindow} window
 */
const saveWindowState = (window) => {
  try {
    const bounds = window.getBounds();
    const state = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: window.isMaximized(),
    };
    fs.writeFileSync(windowStateFile, JSON.stringify(state, null, 2));
    log("Window state saved");
  } catch (err) {
    log("Failed to save window state:", err);
  }
};

/**
 * @param {number} startPort
 * @param {string} [host=loopbackHost]
 * @returns {Promise<number>}
 */
const findAvailablePort = (startPort, host = loopbackHost) => {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.once(
      "error",
      /**
       * @param {NodeJS.ErrnoException} err
       */
      (err) => {
        const code = err?.code;
        if (code === "EADDRINUSE" || code === "EACCES") {
          log(
            `Port ${startPort} on ${host} unavailable, trying ${startPort + 1}`,
          );
          resolve(findAvailablePort(startPort + 1, host));
          return;
        }

        log(
          `Port probe error on ${host}:${startPort} (${code ?? "unknown"}), trying ${startPort + 1}`,
        );
        resolve(findAvailablePort(startPort + 1, host));
      },
    );

    server.listen(startPort, host, () => {
      const address = server.address();
      const port =
        typeof address === "object" && address !== null
          ? address.port
          : startPort;
      server.close(() => {
        log(`Found available port: ${port} on ${host}`);
        resolve(port);
      });
    });
  });
};

/**
 * @typedef {(value: boolean) => void} FinishHandler
 */
/**
 * @param {number} port
 * @param {number} [maxAttempts=30]
 * @param {string} [host=loopbackHost]
 * @param {() => boolean} [shouldStop]
 * @returns {Promise<boolean>}
 */
const waitForServer = (
  port,
  maxAttempts = 30,
  host = loopbackHost,
  shouldStop = () => false,
) => {
  return new Promise((resolve) => {
    /** @type {boolean} */
    let settled = false;
    /** @type {FinishHandler} */
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    let attempts = 0;
    const checkServer = () => {
      if (shouldStop()) {
        finish(false);
        return;
      }

      log(
        `Checking server on ${host}:${port} (attempt ${attempts + 1}/${maxAttempts})`,
      );
      http
        .get(
          `http://${host}:${port}`,
          (/** @type {import('http').IncomingMessage} */ res) => {
            log(`Server responded with status: ${res.statusCode}`);
            if (res.statusCode === 200 || res.statusCode === 304) {
              finish(true);
            } else {
              retry();
            }
          },
        )
        .on(
          "error",
          /**
           * @param {Error} err
           */
          (err) => {
            log(`Server check error: ${err?.message ?? String(err)}`);
            retry();
          },
        );
    };

    const retry = () => {
      attempts++;
      if (shouldStop()) {
        finish(false);
        return;
      }
      if (attempts < maxAttempts) {
        setTimeout(checkServer, 1000);
      } else {
        log("Server failed to start after max attempts");
        finish(false);
      }
    };

    checkServer();
  });
};

/**
 * @returns {Promise<number>}
 */
const startServer = async () => {
  const serverPort = await findAvailablePort(port, loopbackHost);

  /**
   * @param {string} dir
   * @returns {string | undefined}
   */
  const resolveStandaloneServerPath = (dir) => {
    const candidates = [
      path.join(dir, "server.js"),
      path.join(dir, "apps", "web", "server.js"),
    ];
    return candidates.find((candidate) => fs.existsSync(candidate));
  };

  let standaloneDir;
  if (app.isPackaged) {
    const exeDirStandalone = path.join(
      path.dirname(process.execPath),
      ".next",
      "standalone",
    );
    const resourcesStandalone = path.join(
      process.resourcesPath,
      ".next",
      "standalone",
    );
    const exeDirServer = resolveStandaloneServerPath(exeDirStandalone);
    const resourcesServer = resolveStandaloneServerPath(resourcesStandalone);
    if (exeDirServer) {
      standaloneDir = exeDirStandalone;
    } else if (resourcesServer) {
      standaloneDir = resourcesStandalone;
    } else {
      standaloneDir = exeDirStandalone;
    }
  } else {
    standaloneDir = path.join(repoRoot, ".next", "standalone");
  }

  const serverPath = resolveStandaloneServerPath(standaloneDir);

  log("Paths:");
  log("  Standalone dir:", standaloneDir);
  log("  Server:", serverPath);
  log("  isPackaged:", app.isPackaged);

  if (!serverPath) {
    const error = `Server file not found under standalone output: ${standaloneDir}`;
    log("ERROR:", error);
    dialog.showErrorBox("Server Error", error);
    throw new Error(error);
  }

  log("Server file exists, starting...");

  let nodeExecutable = "node";

  if (app.isPackaged) {
    const bundledNodePath = path.join(
      process.resourcesPath,
      "node",
      "node.exe",
    );

    if (fs.existsSync(bundledNodePath)) {
      nodeExecutable = bundledNodePath;
      log("Using bundled Node.js:", bundledNodePath);
    } else {
      try {
        require("child_process").execSync("node --version", {
          stdio: "ignore",
        });
        log("Using system Node.js from PATH");
      } catch (err) {
        const error =
          "Node.js not found. Please install Node.js from https://nodejs.org/";
        log("ERROR:", error);
        dialog.showErrorBox(
          "Node.js Required",
          "This application requires Node.js to be installed.\n\nPlease download and install Node.js from:\nhttps://nodejs.org/\n\nThen restart the application.",
        );
        throw new Error(error);
      }
    }
  } else {
    log("Using Node.js from development environment");
  }

  return new Promise((resolve, reject) => {
    const standaloneNodeModules = path.join(standaloneDir, "node_modules");
    let startupSettled = false;
    let serverExited = false;
    let stderrTail = "";
    let stdoutTail = "";

    /**
     * Keep only the most recent output to include in startup errors.
     * @param {string} current
     * @param {string} chunk
     * @returns {string}
     */
    const appendOutput = (current, chunk) => {
      const next = current + chunk;
      const maxLength = 2000;
      return next.length <= maxLength ? next : next.slice(-maxLength);
    };

    /**
     * @typedef {Object} StartupFailureInfo
     * @property {number | null} code
     * @property {NodeJS.Signals | null} signal
     */

    /**
     * @typedef {(code: number | null, signal: NodeJS.Signals | null) => string} StartupFailureFormatter
     */

    /**
     * @type {StartupFailureFormatter}
     */
    const formatStartupFailure = (code, signal) => {
      const output = (stderrTail.trim() || stdoutTail.trim()).trim();
      const outputSection = output ? `\n\nLast server output:\n${output}` : "";
      return `Server process exited before becoming ready (code: ${code ?? "null"}, signal: ${signal ?? "null"}).${outputSection}`;
    };

    /**
     * @param {Error} error
     * @returns {void}
     */
    const rejectOnce = (error) => {
      if (startupSettled) return;
      startupSettled = true;
      reject(error);
    };

    /**
     * @param {number} value
     * @returns {void}
     */
    const resolveOnce = (value) => {
      if (startupSettled) return;
      startupSettled = true;
      resolve(value);
    };

    /** @type {import('child_process').ChildProcess | null} */
    const runtimeAuthOrigin = `http://${loopbackHost}:${serverPort}`;
    log("  AUTH_URL (runtime):", runtimeAuthOrigin);
    log("  NEXTAUTH_URL (runtime):", runtimeAuthOrigin);

    serverProcess = spawn(nodeExecutable, [serverPath], {
      env: {
        ...process.env,
        PORT: serverPort.toString(),
        HOSTNAME: loopbackHost,
        // Keep Auth.js redirect-uri generation aligned with the actual
        // loopback host/port used by the packaged Electron runtime.
        AUTH_URL: runtimeAuthOrigin,
        NEXTAUTH_URL: runtimeAuthOrigin,
        NEXTAUTH_URL_INTERNAL: runtimeAuthOrigin,
        NODE_ENV: "production",
        ELECTRON_BUILD: "true",
        NODE_PATH: standaloneNodeModules,
      },
      /** @type {string} */
      cwd: standaloneDir,
      stdio: ["ignore", "pipe", "pipe"],
    });

    serverProcess?.stdout?.on("data", (data) => {
      const message = data.toString().trim();
      stdoutTail = appendOutput(stdoutTail, `${message}\n`);
      log("[Server STDOUT]:", message);
    });

    serverProcess?.stderr?.on("data", (data) => {
      const message = data.toString().trim();
      stderrTail = appendOutput(stderrTail, `${message}\n`);
      log("[Server STDERR]:", message);
    });

    serverProcess?.on("error", (/** @type {Error} */ err) => {
      log("[Server ERROR]:", err);
      rejectOnce(err);
    });

    serverProcess?.on("exit", (code, signal) => {
      log(`[Server EXIT] Code: ${code}, Signal: ${signal}`);
      serverExited = true;
      if (!startupSettled) {
        rejectOnce(new Error(formatStartupFailure(code, signal)));
      }
    });

    waitForServer(
      serverPort,
      30,
      loopbackHost,
      () => startupSettled || serverExited,
    ).then((ready) => {
      if (startupSettled) return;
      if (ready) {
        log(`Server started successfully on port ${serverPort}`);
        resolveOnce(serverPort);
      } else {
        const output = (stderrTail.trim() || stdoutTail.trim()).trim();
        const outputSection = output
          ? `\n\nLast server output:\n${output}`
          : "";
        const error = `Server failed to respond after 30 seconds on ${loopbackHost}:${serverPort}.${outputSection}`;
        log("ERROR:", error);
        rejectOnce(new Error(error));
      }
    });
  });
};

/**
 * @returns {Promise<void>}
 */
const createWindow = async () => {
  log("Creating window...");
  log(`Mode: ${isDev ? "Development" : "Production"}`);
  log(`Packaged: ${app.isPackaged}`);
  log(`ELECTRON_PROD: ${process.env.ELECTRON_PROD}`);
  log(`Dev Tools Enabled: ${enableDevTools}`);
  let serverUrl = "";

  if (isDev) {
    log("Development mode - connecting to dev server");
    serverUrl = `http://${loopbackHost}:${port}`;
  } else {
    log("Production mode - starting bundled server");
    try {
      const serverPort = await startServer();
      serverUrl = `http://${loopbackHost}:${serverPort}`;
      log(`Will load URL: ${serverUrl}`);
    } catch (err) {
      log("FATAL ERROR starting server:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      dialog.showErrorBox(
        "Server Start Failed",
        `Failed to start the application server:\n\n${errorMessage}\n\nCheck the console for details.`,
      );
      app.quit();
      return;
    }
  }

  const windowState = ensureWindowStateIsVisible(loadWindowState());

  const iconPath = getIconPath();

  const isWindows = process.platform === "win32";
  const isMac = process.platform === "darwin";
  const isLinux = process.platform === "linux";

  mainWindow = new BrowserWindow({
    title: "Starchild",
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 800,
    minHeight: 600,
    ...(isWindows
      ? {
          frame: true,
        }
      : {}),
    ...(isLinux
      ? {
          frame: false,
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      partition: "persist:darkfloor-art",
    },
    icon: iconPath || undefined,
    backgroundColor: "#0a0a0f",
    show: false,
  });

  mainWindow.webContents.setBackgroundThrottling(false);

  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  mainWindow.on("resize", () => {
    if (mainWindow && !mainWindow.isMaximized()) {
      saveWindowState(mainWindow);
    }
  });

  mainWindow.on("move", () => {
    if (mainWindow && !mainWindow.isMaximized()) {
      saveWindowState(mainWindow);
    }
  });

  mainWindow.on("maximize", () => {
    if (mainWindow) {
      saveWindowState(mainWindow);
    }
    publishWindowState();
  });

  mainWindow.on("unmaximize", () => {
    if (mainWindow) {
      saveWindowState(mainWindow);
    }
    publishWindowState();
  });

  mainWindow.webContents.setWindowOpenHandler(
    /**
     * @param {import('electron').HandlerDetails} details
     * @returns {WindowOpenHandlerResult}
     */
    ({ url }) => {
      log("Window open handler triggered for URL:", url);

      if (isAllowedOAuthNavigation(url)) {
        log("Opening OAuth flow in app window:", url);
        return {
          action: "allow",
          overrideBrowserWindowOptions: {
            webPreferences: {
              preload: path.join(__dirname, "preload.cjs"),
              nodeIntegration: false,
              contextIsolation: true,
              sandbox: true,
            },
          },
        };
      }

      shell.openExternal(url);
      return { action: "deny" };
    },
  );

  mainWindow.webContents.on(
    "will-navigate",
    /**
     * @param {import('electron').Event} event
     * @param {string} url
     * @returns {void}
     */
    (event, url) => {
      log("Navigation requested to:", url);

      const parsedUrl = new URL(url);
      const appUrl = new URL(serverUrl);

      if (parsedUrl.origin === appUrl.origin) {
        log("Allowing same-origin navigation");
        return;
      }

      if (isEquivalentLoopbackOrigin(parsedUrl, appUrl)) {
        log("Allowing equivalent loopback-origin navigation");
        return;
      }

      if (isAllowedOAuthNavigation(url)) {
        log("Allowing OAuth navigation in app:", url);
        return;
      }

      log("Preventing navigation to external site, opening in browser instead");
      event.preventDefault();
      shell.openExternal(url);
    },
  );

  mainWindow.webContents.on(
    "did-navigate",
    (
      /** @type {import('electron').Event} */ _event,
      /** @type {string} */ url,
    ) => {
      log("Navigated to:", url);
    },
  );

  mainWindow.webContents.on("did-start-loading", () => {
    log("Page started loading");
  });

  mainWindow.webContents.on("did-finish-load", () => {
    log("Page finished loading");
    publishWindowState();
  });

  mainWindow.webContents.on(
    "did-fail-load",
    /**
     * @param {import('electron').Event} event
     * @param {number} errorCode
     * @param {string} errorDescription
     */
    (event, errorCode, errorDescription) => {
      log("Page failed to load:", errorCode, errorDescription);
    },
  );

  mainWindow.once("ready-to-show", () => {
    log("Window ready to show");
    mainWindow?.show();
    if (enableDevTools) {
      mainWindow?.webContents.openDevTools();
    }
  });

  log(`Loading URL: ${serverUrl}`);
  mainWindow.loadURL(serverUrl);

  mainWindow.on("close", () => {
    if (mainWindow) {
      saveWindowState(mainWindow);
    }
  });

  mainWindow.on("closed", () => {
    log("Window closed");
    mainWindow = null;
  });

  registerMediaKeys();
};

/**
 * Handle renderer -> main messages.
 * Uses the generic `toMain` channel exposed in `electron/preload.cjs`.
 */
ipcMain.on(
  "toMain",
  /** @param {import("electron").IpcMainEvent} _event */ (_event, message) => {
    if (!message || typeof message !== "object") return;

    /** @type {WindowIpcMessage} */
    const payload = message;

    if (payload.type === "window:minimize") {
      mainWindow?.minimize();
      return;
    }

    if (payload.type === "window:close") {
      mainWindow?.close();
      return;
    }

    if (payload.type === "window:toggleMaximize") {
      if (!mainWindow) return;
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
      return;
    }

    if (payload.type === "window:getState") {
      publishWindowState();
      return;
    }

    if (payload.type === "titlebarOverlay:set") {
      if (!mainWindow || process.platform !== "win32") return;

      const color =
        typeof payload.color === "string" ? payload.color : undefined;
      const symbolColor =
        typeof payload.symbolColor === "string"
          ? payload.symbolColor
          : undefined;
      const height = Number.isFinite(payload.height)
        ? payload.height
        : undefined;
      const theme =
        payload.theme === "light"
          ? "light"
          : payload.theme === "dark"
            ? "dark"
            : undefined;

      /**
       * @param {unknown} value
       * @returns {value is string}
       */
      const isHexColor = (value) =>
        typeof value === "string" &&
        /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value.trim());

      try {
        if (theme) {
          nativeTheme.themeSource = theme;
        }

        if (typeof mainWindow.setTitleBarOverlay === "function") {
          mainWindow.setTitleBarOverlay({
            ...(isHexColor(color) ? { color: color.trim() } : {}),
            ...(isHexColor(symbolColor)
              ? { symbolColor: symbolColor.trim() }
              : {}),
            ...(typeof height === "number" && height > 0
              ? { height: Math.round(height) }
              : {}),
          });
        }
      } catch (err) {
        log("Failed to apply titlebar overlay update:", err);
      }
    }
  },
);

/** @returns {void} */
const registerMediaKeys = () => {
  try {
    globalShortcut.register("MediaPlayPause", () => {
      mainWindow?.webContents.send("media-key", "play-pause");
    });

    globalShortcut.register("MediaNextTrack", () => {
      mainWindow?.webContents.send("media-key", "next");
    });

    globalShortcut.register("MediaPreviousTrack", () => {
      mainWindow?.webContents.send("media-key", "previous");
    });
    log("Media keys registered");
  } catch (err) {
    log("Failed to register media keys:", err);
  }
};

app.whenReady().then(() => {
  log("App ready");

  const ses = session.defaultSession;

  const userDataPath = app.getPath("userData");
  log("User data path:", userDataPath);

  log("Storage path:", ses.getStoragePath());

  ses.cookies.on(
    "changed",
    (
      /** @type {import('electron').Event} */ _event,
      /** @type {import('electron').Cookie} */ cookie,
      /** @type {string} */ cause,
      /** @type {boolean} */ removed,
    ) => {
      if (!removed && isDev) {
        log(`Cookie set: ${cookie.name} (${cause})`);
      }
    },
  );

  ses.cookies.flushStore().then(() => {
    log("Session configured with persistent storage");
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  if (app.isReady()) {
    void createWindow();
  }
});

/**
 * Gracefully shutdown the server process
 * @returns {Promise<void>}
 */
/**
 * @returns {Promise<void>}
 */
const shutdownServer = () => {
  return new Promise((resolve) => {
    if (!serverProcess) {
      resolve();
      return;
    }

    log("Shutting down server gracefully...");

    serverProcess.kill("SIGTERM");

    const killTimeout = setTimeout(() => {
      if (serverProcess) {
        log("Force killing server process");
        serverProcess.kill("SIGKILL");
      }
    }, 5000);

    serverProcess.on("exit", () => {
      clearTimeout(killTimeout);
      log("Server process terminated");
      serverProcess = null;
      resolve();
    });
  });
};

app.on("window-all-closed", async () => {
  log("All windows closed");
  await shutdownServer();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", async (/** @type {import('electron').Event} */ event) => {
  log("App will quit");
  event.preventDefault();

  globalShortcut.unregisterAll();

  try {
    await session.defaultSession.cookies.flushStore();
    log("Cookies flushed to disk");
  } catch (err) {
    log("Error flushing cookies:", err);
  }

  await shutdownServer();

  app.exit(0);
});

if (!isDev) {
  Menu.setApplicationMenu(null);
}

process.on("uncaughtException", (/** @type {Error} */ err) => {
  log("Uncaught exception:", err);
});

process.on("unhandledRejection", (/** @type {unknown} */ err) => {
  log("Unhandled rejection:", err);
});
