#!/usr/bin/env node
// File: scripts/encrypt-env-cert.js

import {
  constants,
  createPublicKey,
  createCipheriv,
  publicEncrypt,
  randomBytes,
} from "crypto";
import fs from "fs";
import path from "path";

const VERSION = 1;
const ALGORITHM = "aes-256-gcm+rsa-oaep-sha256";

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node scripts/encrypt-env-cert.js --in <env-file> --cert <public-cert.pem> --out <encrypted-file>",
      "",
      "Options:",
      "  --in      Source .env file (plaintext)",
      "  --cert    RSA public certificate or public key PEM",
      "  --out     Output encrypted JSON payload (.enc)",
      "  --force   Overwrite output if it exists",
    ].join("\n"),
  );
}

/**
 * @param {string[]} argv
 * @returns {{inputFile:string; certFile:string; outputFile:string; force:boolean}}
 */
function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token) continue;
    if (token === "--force") {
      args.force = true;
      continue;
    }
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for argument "${token}"`);
    }
    args[key] = value;
    i += 1;
  }

  const inputFile = typeof args.in === "string" ? args.in : "";
  const certFile = typeof args.cert === "string" ? args.cert : "";
  const outputFile = typeof args.out === "string" ? args.out : "";

  if (!inputFile || !certFile || !outputFile) {
    throw new Error("Required arguments are missing");
  }

  return {
    inputFile,
    certFile,
    outputFile,
    force: args.force === true,
  };
}

function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    process.exit(0);
  }

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

  const inputPath = path.resolve(options.inputFile);
  const certPath = path.resolve(options.certFile);
  const outputPath = path.resolve(options.outputFile);

  if (!fs.existsSync(inputPath)) {
    console.error(`Input env file not found: ${inputPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(certPath)) {
    console.error(`Certificate file not found: ${certPath}`);
    process.exit(1);
  }
  if (fs.existsSync(outputPath) && !options.force) {
    console.error(`Output file already exists: ${outputPath}`);
    console.error("Use --force to overwrite it.");
    process.exit(1);
  }

  const envText = fs.readFileSync(inputPath, "utf8");
  const certPem = fs.readFileSync(certPath, "utf8");
  const publicKey = createPublicKey(certPem);

  const symmetricKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", symmetricKey, iv);
  const ciphertext = Buffer.concat([cipher.update(envText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  const encryptedKey = publicEncrypt(
    {
      key: publicKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    symmetricKey,
  );

  const payload = {
    version: VERSION,
    algorithm: ALGORITHM,
    encryptedKey: encryptedKey.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    createdAt: new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log("Encrypted env written:", outputPath);
  console.log("Algorithm:", ALGORITHM);
  console.log("Version:", VERSION);
}

main();
