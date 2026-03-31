#!/usr/bin/env node
// File: apps/desktop/scripts/prepare-electron-env.cjs

const fs = require("fs");
const path = require("path");
const {
  constants,
  createCipheriv,
  createPublicKey,
  publicEncrypt,
  randomBytes,
} = require("crypto");

const VERSION = 1;
const ALGORITHM = "aes-256-gcm+rsa-oaep-sha256";

const repoRoot = path.resolve(__dirname, "../../..");
const { ensureKeypair } = require(
  path.resolve(repoRoot, "scripts/create-keypair.cjs"),
);
const sourceEnvPath = path.resolve(
  repoRoot,
  process.env.ELECTRON_ENV_SOURCE_FILE || ".env.local",
);
const encryptedEnvPath = path.resolve(
  repoRoot,
  process.env.ELECTRON_ENV_ENCRYPTED_FILE || ".next/standalone/.env.local.enc",
);
const privateKeyPath = path.resolve(
  repoRoot,
  process.env.ELECTRON_ENV_PRIVATE_KEY_PATH ||
    "certs/starchild-env-private.key",
);
const publicKeyPath = path.resolve(
  repoRoot,
  process.env.ELECTRON_ENV_PUBLIC_KEY_PATH || "certs/starchild-env-public.pem",
);
const keyBits = Number(process.env.ELECTRON_ENV_RSA_BITS || "4096");
const autoEncryptEnabled = process.env.ELECTRON_AUTO_ENCRYPT_ENV !== "false";

/**
 * @param {string} envText
 * @param {string} publicKeyPem
 * @returns {Record<string, string | number>}
 */
function encryptEnv(envText, publicKeyPem) {
  const publicKey = createPublicKey(publicKeyPem);
  const symmetricKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", symmetricKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(envText, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const encryptedKey = publicEncrypt(
    {
      key: publicKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    symmetricKey,
  );

  return {
    version: VERSION,
    algorithm: ALGORITHM,
    encryptedKey: encryptedKey.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    createdAt: new Date().toISOString(),
  };
}

if (!autoEncryptEnabled) {
  console.log(
    "[Electron env] ELECTRON_AUTO_ENCRYPT_ENV=false, skipping encrypted env generation.",
  );
  process.exit(0);
}

if (!fs.existsSync(sourceEnvPath)) {
  if (fs.existsSync(encryptedEnvPath)) {
    fs.rmSync(encryptedEnvPath, { force: true });
    console.log(
      "[Electron env] Removed stale encrypted env file:",
      encryptedEnvPath,
    );
  }
  console.warn(
    "[Electron env] Source env file not found, skipping encryption:",
    sourceEnvPath,
  );
  process.exit(0);
}

if (!Number.isInteger(keyBits) || keyBits < 2048) {
  console.error(
    "[Electron env] Invalid ELECTRON_ENV_RSA_BITS value. Expected integer >= 2048.",
  );
  process.exit(1);
}

try {
  const keypairResult = ensureKeypair({
    privateKeyPath,
    publicKeyPath,
    bits: keyBits,
  });
  console.log(
    keypairResult.created
      ? "[Electron env] Generated RSA keypair."
      : "[Electron env] Reusing existing RSA keypair.",
  );
  console.log("[Electron env] Private key:", keypairResult.privateKeyPath);
  console.log("[Electron env] Public key:", keypairResult.publicKeyPath);

  const envText = fs.readFileSync(sourceEnvPath, "utf8");
  const publicKeyPem = fs.readFileSync(publicKeyPath, "utf8");
  const payload = encryptEnv(envText, publicKeyPem);

  fs.mkdirSync(path.dirname(encryptedEnvPath), { recursive: true });
  fs.writeFileSync(
    encryptedEnvPath,
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );

  console.log("[Electron env] Encrypted env file:", encryptedEnvPath);
  console.log("[Electron env] Algorithm:", ALGORITHM);
} catch (error) {
  console.error(
    "[Electron env] Failed to prepare encrypted env:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
}
