#!/usr/bin/env node
// File: apps/desktop/scripts/resolve-runtime-env.cjs

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ENV_PAYLOAD_VERSION = 1;
const ENV_PAYLOAD_ALGORITHM = "aes-256-gcm+rsa-oaep-sha256";
const TAURI_RUNTIME_BUNDLE_VERSION = 1;
const TAURI_KEY_BUNDLE_VERSION = 1;
const TAURI_KEY_BUNDLE_ALGORITHM = "xor-stream-sha256-ca-v1";
const TAURI_MASK_DOMAIN = "starchild-tauri-runtime-env";

/**
 * @param {string | undefined} value
 * @returns {string | undefined}
 */
function normalizeArg(value) {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * @param {Array<string | undefined>} values
 * @returns {string[]}
 */
function compactPaths(values) {
  return values.filter(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
}

/**
 * @param {string | undefined} explicitPath
 * @param {string[]} searchRoots
 * @returns {string | undefined}
 */
function resolveExplicitPath(explicitPath, searchRoots) {
  const candidate = normalizeArg(explicitPath);
  if (!candidate) return undefined;

  if (path.isAbsolute(candidate)) {
    return candidate;
  }

  for (const root of searchRoots) {
    const resolved = path.join(root, candidate);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }

  return undefined;
}

/**
 * @param {string} value
 * @returns {Buffer}
 */
function decodeBase64(value) {
  return Buffer.from(value, "base64");
}

/**
 * @param {string} value
 * @returns {string}
 */
function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * @param {unknown} payload
 * @returns {Record<string, unknown>}
 */
function parseEncryptedPayloadRecord(payload) {
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

  return record;
}

/**
 * @param {Record<string, unknown>} record
 * @param {string} privateKeyPem
 * @param {string | undefined} passphrase
 * @returns {string}
 */
function decryptPayloadRecord(record, privateKeyPem, passphrase) {
  const encryptedKey = /** @type {string} */ (record.encryptedKey);
  const iv = /** @type {string} */ (record.iv);
  const tag = /** @type {string} */ (record.tag);
  const ciphertext = /** @type {string} */ (record.ciphertext);

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
}

/**
 * @param {string} envFilePath
 * @param {string} keyFilePath
 * @param {string | undefined} passphrase
 * @returns {string}
 */
function decryptEnvPayload(envFilePath, keyFilePath, passphrase) {
  const payloadRaw = fs.readFileSync(envFilePath, "utf8");
  const payload = JSON.parse(payloadRaw);
  const record = parseEncryptedPayloadRecord(payload);
  const privateKeyPem = fs.readFileSync(keyFilePath, "utf8");
  return decryptPayloadRecord(record, privateKeyPem, passphrase);
}

/**
 * @param {string} envText
 * @returns {Record<string, string>}
 */
function parseEnvText(envText) {
  /** @type {Record<string, string>} */
  const parsed = {};
  const normalized = envText.replace(/\r\n/g, "\n");

  for (const rawLine of normalized.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const exportPrefix = line.startsWith("export ") ? "export ".length : 0;
    const assignmentIndex = line.indexOf("=", exportPrefix);
    if (assignmentIndex <= exportPrefix) continue;

    const key = line.slice(exportPrefix, assignmentIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = line.slice(assignmentIndex + 1).trim();
    if (!value) {
      parsed[key] = "";
      continue;
    }

    const quote = value[0];
    if (
      (quote === '"' || quote === "'") &&
      value.length >= 2 &&
      value.at(-1) === quote
    ) {
      value = value.slice(1, -1);
      if (quote === '"') {
        value = value
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\");
      } else {
        value = value.replace(/\\'/g, "'");
      }
    } else {
      const commentIndex = value.search(/\s#/);
      if (commentIndex >= 0) {
        value = value.slice(0, commentIndex).trimEnd();
      }
    }

    parsed[key] = value;
  }

  return parsed;
}

/**
 * @param {string[]} paths
 * @returns {string[]}
 */
function existingFiles(paths) {
  return paths.filter(
    (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
  );
}

/**
 * @param {number} length
 * @param {Buffer} salt
 * @param {string} identifier
 * @param {string} caText
 * @returns {Buffer}
 */
function deriveMask(length, salt, identifier, caText) {
  const chunks = [];
  let produced = 0;
  let counter = 0;

  while (produced < length) {
    const counterBuffer = Buffer.allocUnsafe(4);
    counterBuffer.writeUInt32BE(counter, 0);
    const digest = crypto
      .createHash("sha256")
      .update(TAURI_MASK_DOMAIN)
      .update("\0")
      .update(identifier)
      .update("\0")
      .update(salt)
      .update("\0")
      .update(caText)
      .update("\0")
      .update(counterBuffer)
      .digest();
    chunks.push(digest);
    produced += digest.length;
    counter += 1;
  }

  return Buffer.concat(chunks).subarray(0, length);
}

/**
 * @param {Buffer} source
 * @param {Buffer} mask
 * @returns {Buffer}
 */
function xorBuffers(source, mask) {
  const output = Buffer.allocUnsafe(source.length);
  for (let index = 0; index < source.length; index += 1) {
    output[index] = source[index] ^ mask[index];
  }
  return output;
}

/**
 * @param {string} bundlePath
 * @param {string} resourceStandaloneDir
 * @param {string | undefined} passphrase
 * @returns {Record<string, string>}
 */
function decryptBundledTauriRuntimeEnv(bundlePath, resourceStandaloneDir, passphrase) {
  const bundleRaw = fs.readFileSync(bundlePath, "utf8");
  const bundle = JSON.parse(bundleRaw);

  if (!bundle || typeof bundle !== "object") {
    throw new Error("Tauri runtime env bundle is not a valid JSON object");
  }

  const record = /** @type {Record<string, unknown>} */ (bundle);
  if (record.version !== TAURI_RUNTIME_BUNDLE_VERSION) {
    throw new Error(
      `Unsupported Tauri runtime env bundle version: ${String(record.version)}`,
    );
  }

  const appIdentifier =
    typeof record.appIdentifier === "string" ? record.appIdentifier : "";
  const envPayload = parseEncryptedPayloadRecord(record.envPayload);
  const keyBundle =
    record.keyBundle && typeof record.keyBundle === "object"
      ? /** @type {Record<string, unknown>} */ (record.keyBundle)
      : null;

  if (!keyBundle) {
    throw new Error("Tauri runtime env bundle is missing key bundle metadata");
  }
  if (keyBundle.version !== TAURI_KEY_BUNDLE_VERSION) {
    throw new Error(
      `Unsupported Tauri key bundle version: ${String(keyBundle.version)}`,
    );
  }
  if (keyBundle.algorithm !== TAURI_KEY_BUNDLE_ALGORITHM) {
    throw new Error(
      `Unsupported Tauri key bundle algorithm: ${String(keyBundle.algorithm)}`,
    );
  }
  if (
    typeof keyBundle.salt !== "string" ||
    !Array.isArray(keyBundle.chunks) ||
    typeof keyBundle.keyLength !== "number"
  ) {
    throw new Error("Tauri key bundle is missing required fields");
  }

  const usesCaPem = keyBundle.usesCaPem === true;
  let caText = "";
  if (usesCaPem) {
    const caPemPath = path.join(resourceStandaloneDir, "certs", "ca.pem");
    if (!fs.existsSync(caPemPath)) {
      throw new Error(
        `Tauri runtime env bundle requires certs/ca.pem but it was not found at ${caPemPath}`,
      );
    }
    caText = fs.readFileSync(caPemPath, "utf8");
    const expectedFingerprint =
      typeof keyBundle.caFingerprint === "string" ? keyBundle.caFingerprint : null;
    if (expectedFingerprint && sha256Hex(caText) !== expectedFingerprint) {
      throw new Error(
        "certs/ca.pem fingerprint does not match the bundled runtime env metadata",
      );
    }
  }

  const obfuscatedKey = Buffer.concat(
    keyBundle.chunks.map((chunk) => {
      if (typeof chunk !== "string") {
        throw new Error("Invalid key chunk in Tauri runtime env bundle");
      }
      return decodeBase64(chunk);
    }),
  ).subarray(0, keyBundle.keyLength);

  const salt = decodeBase64(keyBundle.salt);
  const mask = deriveMask(obfuscatedKey.length, salt, appIdentifier, caText);
  const privateKeyPem = xorBuffers(obfuscatedKey, mask).toString("utf8");
  return parseEnvText(decryptPayloadRecord(envPayload, privateKeyPem, passphrase));
}

/**
 * @param {Record<string, string>} values
 * @param {string | null} source
 * @param {string} mode
 * @returns {never}
 */
function outputResolution(values, source, mode) {
  process.stdout.write(
    JSON.stringify({
      source,
      mode,
      values,
    }),
  );
  process.exit(0);
}

const resourceDir = normalizeArg(process.argv[2]);
const exeDir = normalizeArg(process.argv[3]);
const appConfigDir = normalizeArg(process.argv[4]);
const currentDir = normalizeArg(process.argv[5]);

if (process.env.STARCHILD_RUNTIME_ENV_OUTPUT !== "json") {
  console.error(
    "[resolve-runtime-env] This helper is intended to be called by the packaged desktop runtime.",
  );
  process.exit(1);
}

if (!resourceDir) {
  console.error("[resolve-runtime-env] Missing resource directory argument");
  process.exit(1);
}

const resourceStandaloneDir = path.join(resourceDir, "standalone");
const bundledRuntimeEnvPath = path.join(
  resourceDir,
  "runtime",
  "tauri-runtime-env.json",
);
const privateKeyPassphrase =
  process.env.STARCHILD_ENV_PRIVATE_KEY_PASSPHRASE || undefined;

const explicitSearchRoots = compactPaths([exeDir, appConfigDir]);
const explicitPlaintextEnv = resolveExplicitPath(
  process.env.STARCHILD_ENV_FILE,
  explicitSearchRoots,
);
const explicitEncryptedEnv = resolveExplicitPath(
  process.env.STARCHILD_ENC_ENV_FILE,
  explicitSearchRoots,
);
const explicitKeyPath = resolveExplicitPath(
  process.env.STARCHILD_ENV_PRIVATE_KEY_FILE,
  explicitSearchRoots,
);

const plaintextEnvPaths = compactPaths([
  exeDir ? path.join(exeDir, ".env.local") : undefined,
  exeDir ? path.join(exeDir, ".env") : undefined,
  appConfigDir ? path.join(appConfigDir, ".env.local") : undefined,
  appConfigDir ? path.join(appConfigDir, ".env") : undefined,
  path.join(resourceStandaloneDir, ".env.local"),
  path.join(resourceStandaloneDir, ".env"),
]);

const encryptedEnvPaths = compactPaths([
  exeDir ? path.join(exeDir, ".env.local.enc") : undefined,
  exeDir ? path.join(exeDir, ".env.enc") : undefined,
  appConfigDir ? path.join(appConfigDir, ".env.local.enc") : undefined,
  appConfigDir ? path.join(appConfigDir, ".env.enc") : undefined,
  path.join(resourceStandaloneDir, ".env.local.enc"),
  path.join(resourceStandaloneDir, ".env.enc"),
]);

const privateKeyPaths = compactPaths([
  explicitKeyPath,
  exeDir ? path.join(exeDir, ".env.private.key") : undefined,
  exeDir ? path.join(exeDir, "ca.key") : undefined,
  exeDir ? path.join(exeDir, "starchild-env-private.key") : undefined,
  appConfigDir ? path.join(appConfigDir, ".env.private.key") : undefined,
  appConfigDir ? path.join(appConfigDir, "ca.key") : undefined,
  appConfigDir ? path.join(appConfigDir, "starchild-env-private.key") : undefined,
  path.join(resourceStandaloneDir, "certs", "ca.key"),
  path.join(resourceStandaloneDir, "certs", "starchild-env-private.key"),
  path.join(resourceStandaloneDir, ".env.private.key"),
]);

if (explicitEncryptedEnv) {
  const explicitKeys = existingFiles(privateKeyPaths);
  for (const keyPath of explicitKeys) {
    try {
      outputResolution(
        parseEnvText(
          decryptEnvPayload(explicitEncryptedEnv, keyPath, privateKeyPassphrase),
        ),
        explicitEncryptedEnv,
        "encrypted",
      );
    } catch (error) {
      console.error(
        "[resolve-runtime-env] Failed to decrypt explicit env payload:",
        explicitEncryptedEnv,
        keyPath,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}

if (explicitPlaintextEnv) {
  try {
    outputResolution(
      parseEnvText(fs.readFileSync(explicitPlaintextEnv, "utf8")),
      explicitPlaintextEnv,
      "plaintext",
    );
  } catch (error) {
    console.error(
      "[resolve-runtime-env] Failed to read explicit env file:",
      explicitPlaintextEnv,
      error instanceof Error ? error.message : String(error),
    );
  }
}

if (fs.existsSync(bundledRuntimeEnvPath)) {
  try {
    outputResolution(
      decryptBundledTauriRuntimeEnv(
        bundledRuntimeEnvPath,
        resourceStandaloneDir,
        privateKeyPassphrase,
      ),
      bundledRuntimeEnvPath,
      "encrypted+obfuscated",
    );
  } catch (error) {
    console.error(
      "[resolve-runtime-env] Failed to resolve bundled Tauri runtime env:",
      bundledRuntimeEnvPath,
      error instanceof Error ? error.message : String(error),
    );
  }
}

for (const envPath of existingFiles(encryptedEnvPaths)) {
  const keys = existingFiles(privateKeyPaths);
  for (const keyPath of keys) {
    try {
      outputResolution(
        parseEnvText(decryptEnvPayload(envPath, keyPath, privateKeyPassphrase)),
        envPath,
        "encrypted",
      );
    } catch (error) {
      console.error(
        "[resolve-runtime-env] Failed to decrypt env payload:",
        envPath,
        keyPath,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}

for (const envPath of existingFiles(plaintextEnvPaths)) {
  try {
    outputResolution(
      parseEnvText(fs.readFileSync(envPath, "utf8")),
      envPath,
      "plaintext",
    );
  } catch (error) {
    console.error(
      "[resolve-runtime-env] Failed to read env file:",
      envPath,
      error instanceof Error ? error.message : String(error),
    );
  }
}

process.stdout.write(
  JSON.stringify({
    source: null,
    mode: "none",
    values: {},
  }),
);
