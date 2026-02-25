#!/usr/bin/env node
// File: scripts/create-keypair.cjs

const fs = require("fs");
const path = require("path");
const { generateKeyPairSync } = require("crypto");

const DEFAULT_PRIVATE_KEY_PATH = path.resolve(
  process.cwd(),
  "certs/starchild-env-private.key",
);
const DEFAULT_PUBLIC_KEY_PATH = path.resolve(
  process.cwd(),
  "certs/starchild-env-public.pem",
);

/**
 * @typedef {Object} KeypairOptions
 * @property {string} [privateKeyPath]
 * @property {string} [publicKeyPath]
 * @property {number} [bits]
 * @property {boolean} [force]
 */

/**
 * @typedef {Object} KeypairResult
 * @property {boolean} created
 * @property {string} privateKeyPath
 * @property {string} publicKeyPath
 * @property {number} bits
 */

/**
 * @param {string} filePath
 * @param {string} content
 * @param {number} mode
 * @returns {void}
 */
function writeFile(filePath, content, mode) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, { encoding: "utf8", mode });
  fs.chmodSync(filePath, mode);
}

/**
 * @param {KeypairOptions} options
 * @returns {KeypairResult}
 */
function ensureKeypair(options = {}) {
  const privateKeyPath = path.resolve(
    options.privateKeyPath ?? DEFAULT_PRIVATE_KEY_PATH,
  );
  const publicKeyPath = path.resolve(
    options.publicKeyPath ?? DEFAULT_PUBLIC_KEY_PATH,
  );
  const bits = options.bits ?? 4096;
  const force = options.force === true;

  if (!Number.isInteger(bits) || bits < 2048) {
    throw new Error(`Invalid key size: ${bits}. Expected integer >= 2048.`);
  }

  const hasPrivate = fs.existsSync(privateKeyPath);
  const hasPublic = fs.existsSync(publicKeyPath);

  if (hasPrivate && hasPublic && !force) {
    return {
      created: false,
      privateKeyPath,
      publicKeyPath,
      bits,
    };
  }

  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: bits,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  writeFile(privateKeyPath, privateKey, 0o600);
  writeFile(publicKeyPath, publicKey, 0o644);

  return {
    created: true,
    privateKeyPath,
    publicKeyPath,
    bits,
  };
}

/**
 * @param {string[]} argv
 * @returns {KeypairOptions & {help:boolean}}
 */
function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token) continue;

    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    if (token === "--force") {
      args.force = true;
      continue;
    }
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for argument ${token}`);
    }
    args[key] = value;
    index += 1;
  }

  return {
    help: args.help === true,
    force: args.force === true,
    privateKeyPath: typeof args.private === "string" ? args.private : undefined,
    publicKeyPath: typeof args.public === "string" ? args.public : undefined,
    bits: typeof args.bits === "string" ? Number(args.bits) : undefined,
  };
}

/**
 * @returns {void}
 */
function printUsage() {
  console.log(
    [
      "Usage:",
      "  node scripts/create-keypair.cjs [options]",
      "",
      "Options:",
      "  --private <path>  Private key output path (default: certs/starchild-env-private.key)",
      "  --public <path>   Public key output path  (default: certs/starchild-env-public.pem)",
      "  --bits <number>   RSA key size (default: 4096)",
      "  --force           Regenerate keys even if files already exist",
      "  --help            Show this help message",
    ].join("\n"),
  );
}

if (require.main === module) {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(
      "Argument error:",
      error instanceof Error ? error.message : String(error),
    );
    printUsage();
    process.exit(1);
  }

  if (options.help) {
    printUsage();
    process.exit(0);
  }

  try {
    const result = ensureKeypair(options);
    console.log(
      result.created
        ? "Generated RSA keypair for Electron env encryption."
        : "RSA keypair already exists. Reusing existing files.",
    );
    console.log("Private key:", result.privateKeyPath);
    console.log("Public key:", result.publicKeyPath);
    console.log("Bits:", result.bits);
  } catch (error) {
    console.error(
      "Failed to create keypair:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

module.exports = {
  ensureKeypair,
};
