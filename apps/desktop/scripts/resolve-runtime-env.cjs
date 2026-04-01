#!/usr/bin/env node
// File: apps/desktop/scripts/resolve-runtime-env.cjs

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const dotenv = require("dotenv");

const ENV_PAYLOAD_VERSION = 1;
const ENV_PAYLOAD_ALGORITHM = "aes-256-gcm+rsa-oaep-sha256";

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
 * @param {string} value
 * @returns {Buffer}
 */
function decodeBase64(value) {
  return Buffer.from(value, "base64");
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
}

/**
 * @param {string} envText
 * @returns {Record<string, string>}
 */
function parseEnvText(envText) {
  return dotenv.parse(envText);
}

/**
 * @param {string[]} paths
 * @returns {string[]}
 */
function existingFiles(paths) {
  return paths.filter((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
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
const privateKeyPassphrase =
  process.env.STARCHILD_ENV_PRIVATE_KEY_PASSPHRASE || undefined;

const explicitPlaintextEnv = normalizeArg(process.env.STARCHILD_ENV_FILE);
const explicitEncryptedEnv = normalizeArg(process.env.STARCHILD_ENC_ENV_FILE);
const explicitKeyPath = normalizeArg(process.env.STARCHILD_ENV_PRIVATE_KEY_FILE);

const plaintextEnvPaths = compactPaths([
  explicitPlaintextEnv,
  exeDir ? path.join(exeDir, ".env.local") : undefined,
  exeDir ? path.join(exeDir, ".env") : undefined,
  appConfigDir ? path.join(appConfigDir, ".env.local") : undefined,
  appConfigDir ? path.join(appConfigDir, ".env") : undefined,
  currentDir ? path.join(currentDir, ".env.local") : undefined,
  currentDir ? path.join(currentDir, ".env") : undefined,
  path.join(resourceStandaloneDir, ".env.local"),
  path.join(resourceStandaloneDir, ".env"),
]);

const encryptedEnvPaths = compactPaths([
  explicitEncryptedEnv,
  exeDir ? path.join(exeDir, ".env.local.enc") : undefined,
  exeDir ? path.join(exeDir, ".env.enc") : undefined,
  appConfigDir ? path.join(appConfigDir, ".env.local.enc") : undefined,
  appConfigDir ? path.join(appConfigDir, ".env.enc") : undefined,
  currentDir ? path.join(currentDir, ".env.local.enc") : undefined,
  currentDir ? path.join(currentDir, ".env.enc") : undefined,
  path.join(resourceStandaloneDir, ".env.local.enc"),
  path.join(resourceStandaloneDir, ".env.enc"),
]);

const privateKeyPaths = compactPaths([
  explicitKeyPath,
  exeDir ? path.join(exeDir, ".env.private.key") : undefined,
  exeDir ? path.join(exeDir, "starchild-env-private.key") : undefined,
  appConfigDir ? path.join(appConfigDir, ".env.private.key") : undefined,
  appConfigDir ? path.join(appConfigDir, "starchild-env-private.key") : undefined,
  currentDir ? path.join(currentDir, ".env.private.key") : undefined,
  currentDir ? path.join(currentDir, "starchild-env-private.key") : undefined,
  path.join(resourceStandaloneDir, "certs", "starchild-env-private.key"),
  path.join(resourceStandaloneDir, ".env.private.key"),
]);

for (const envPath of existingFiles(encryptedEnvPaths)) {
  const keys = existingFiles(privateKeyPaths);
  for (const keyPath of keys) {
    try {
      const decryptedEnv = decryptEnvPayload(
        envPath,
        keyPath,
        privateKeyPassphrase,
      );
      const parsed = parseEnvText(decryptedEnv);
      process.stdout.write(
        JSON.stringify({
          source: envPath,
          mode: "encrypted",
          values: parsed,
        }),
      );
      process.exit(0);
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
    const envText = fs.readFileSync(envPath, "utf8");
    const parsed = parseEnvText(envText);
    process.stdout.write(
      JSON.stringify({
        source: envPath,
        mode: "plaintext",
        values: parsed,
      }),
    );
    process.exit(0);
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
