#!/usr/bin/env node
// File: apps/desktop/scripts/prepare-tauri-runtime-env.cjs

const fs = require("fs");
const path = require("path");
const {
  constants,
  createCipheriv,
  createHash,
  createPublicKey,
  publicEncrypt,
  randomBytes,
} = require("crypto");

const VERSION = 1;
const ALGORITHM = "aes-256-gcm+rsa-oaep-sha256";
const KEY_BUNDLE_VERSION = 1;
const KEY_BUNDLE_ALGORITHM = "xor-stream-sha256-ca-v1";
const MASK_DOMAIN = "starchild-tauri-runtime-env";
const DEFAULT_APP_IDENTIFIER = "org.darkfloor.starchild.tauri.experimental";

const repoRoot = path.resolve(__dirname, "../../..");
const { ensureKeypair } = require(
  path.resolve(repoRoot, "scripts/create-keypair.cjs"),
);

const preferredCaPrivateKeyPath = path.resolve(repoRoot, "certs/ca.key");
const preferredCaCertPath = path.resolve(repoRoot, "certs/ca.pem");
const fallbackPrivateKeyPath = path.resolve(
  repoRoot,
  "certs/starchild-env-private.key",
);
const fallbackPublicKeyPath = path.resolve(
  repoRoot,
  "certs/starchild-env-public.pem",
);

const sourceEnvPath = path.resolve(
  repoRoot,
  process.env.TAURI_ENV_SOURCE_FILE || ".env.local",
);
const outputBundlePath = path.resolve(
  repoRoot,
  process.env.TAURI_ENV_BUNDLE_FILE ||
    "apps/desktop/src-tauri/b/runtime/tauri-runtime-env.json",
);
const privateKeyPath = path.resolve(
  repoRoot,
  process.env.TAURI_ENV_PRIVATE_KEY_PATH ||
    (fs.existsSync(preferredCaPrivateKeyPath)
      ? "certs/ca.key"
      : "certs/starchild-env-private.key"),
);
const publicKeyPath = path.resolve(
  repoRoot,
  process.env.TAURI_ENV_PUBLIC_KEY_PATH ||
    (fs.existsSync(preferredCaCertPath)
      ? "certs/ca.pem"
      : "certs/starchild-env-public.pem"),
);
const caCertPath = path.resolve(
  repoRoot,
  process.env.TAURI_ENV_CA_CERT_PATH || "certs/ca.pem",
);
const appIdentifier =
  process.env.TAURI_ENV_APP_IDENTIFIER || DEFAULT_APP_IDENTIFIER;
const keyBits = Number(process.env.TAURI_ENV_RSA_BITS || "4096");
const autoEncryptEnabled = process.env.TAURI_AUTO_ENCRYPT_ENV !== "false";
const chunkSize = Number(process.env.TAURI_ENV_KEY_CHUNK_SIZE || "240");

/**
 * @param {string} value
 * @returns {string}
 */
function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

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
    const digest = createHash("sha256")
      .update(MASK_DOMAIN)
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
 * @param {Buffer} data
 * @param {number} size
 * @returns {string[]}
 */
function toBase64Chunks(data, size) {
  /** @type {string[]} */
  const chunks = [];
  for (let offset = 0; offset < data.length; offset += size) {
    chunks.push(data.subarray(offset, offset + size).toString("base64"));
  }
  return chunks;
}

if (!autoEncryptEnabled) {
  console.log(
    "[Tauri env] TAURI_AUTO_ENCRYPT_ENV=false, skipping runtime env bundle generation.",
  );
  process.exit(0);
}

if (!Number.isInteger(keyBits) || keyBits < 2048) {
  console.error(
    "[Tauri env] Invalid TAURI_ENV_RSA_BITS value. Expected integer >= 2048.",
  );
  process.exit(1);
}

if (!Number.isInteger(chunkSize) || chunkSize < 64) {
  console.error(
    "[Tauri env] Invalid TAURI_ENV_KEY_CHUNK_SIZE value. Expected integer >= 64.",
  );
  process.exit(1);
}

if (!fs.existsSync(sourceEnvPath)) {
  if (fs.existsSync(outputBundlePath)) {
    fs.rmSync(outputBundlePath, { force: true });
    console.log(
      "[Tauri env] Removed stale runtime env bundle:",
      outputBundlePath,
    );
  }
  console.warn(
    "[Tauri env] Source env file not found, skipping runtime env bundle:",
    sourceEnvPath,
  );
  process.exit(0);
}

try {
  if (
    privateKeyPath === fallbackPrivateKeyPath &&
    publicKeyPath === fallbackPublicKeyPath
  ) {
    const keypairResult = ensureKeypair({
      privateKeyPath,
      publicKeyPath,
      bits: keyBits,
    });
    console.log(
      keypairResult.created
        ? "[Tauri env] Generated fallback RSA keypair."
        : "[Tauri env] Reusing fallback RSA keypair.",
    );
  } else {
    if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
      throw new Error(
        `Configured Tauri env keypair is incomplete. Expected ${privateKeyPath} and ${publicKeyPath}`,
      );
    }
    console.log("[Tauri env] Reusing configured cert/key pair.");
  }

  const envText = fs.readFileSync(sourceEnvPath, "utf8");
  const publicKeyPem = fs.readFileSync(publicKeyPath, "utf8");
  const privateKeyPem = fs.readFileSync(privateKeyPath, "utf8");
  const envPayload = encryptEnv(envText, publicKeyPem);

  let caText = "";
  let usesCaPem = false;
  let caFingerprint = null;
  if (fs.existsSync(caCertPath)) {
    caText = fs.readFileSync(caCertPath, "utf8");
    usesCaPem = caText.trim().length > 0;
    caFingerprint = usesCaPem ? sha256Hex(caText) : null;
  } else {
    console.warn(
      "[Tauri env] certs/ca.pem not found. Falling back to identifier-only obfuscation.",
    );
  }

  const salt = randomBytes(32);
  const privateKeyBytes = Buffer.from(privateKeyPem, "utf8");
  const mask = deriveMask(privateKeyBytes.length, salt, appIdentifier, caText);
  const obfuscatedKeyBytes = xorBuffers(privateKeyBytes, mask);

  const bundle = {
    version: VERSION,
    createdAt: new Date().toISOString(),
    appIdentifier,
    envPayload,
    keyBundle: {
      version: KEY_BUNDLE_VERSION,
      algorithm: KEY_BUNDLE_ALGORITHM,
      usesCaPem,
      caFingerprint,
      salt: salt.toString("base64"),
      keyLength: privateKeyBytes.length,
      chunkSize,
      chunks: toBase64Chunks(obfuscatedKeyBytes, chunkSize),
    },
  };

  fs.mkdirSync(path.dirname(outputBundlePath), { recursive: true });
  fs.writeFileSync(
    outputBundlePath,
    `${JSON.stringify(bundle, null, 2)}\n`,
    "utf8",
  );

  console.log("[Tauri env] Runtime env bundle:", outputBundlePath);
  console.log("[Tauri env] Uses certs/ca.pem:", usesCaPem);
  if (caFingerprint) {
    console.log("[Tauri env] certs/ca.pem fingerprint:", caFingerprint);
  }
} catch (error) {
  console.error(
    "[Tauri env] Failed to prepare runtime env bundle:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
}
