#!/usr/bin/env node
// File: apps/desktop/scripts/download-node.js

import { exec } from "child_process";
import fs from "fs";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

const NODE_VERSION = process.env.NODE_DOWNLOAD_VERSION || "20.18.2";
const TARGET_PLATFORM = process.env.NODE_DOWNLOAD_PLATFORM || process.platform;
const TARGET_ARCH = process.env.NODE_DOWNLOAD_ARCH || process.arch;
const OUTPUT_DIR = path.join(repoRoot, "resources", "node");
const METADATA_PATH = path.join(OUTPUT_DIR, ".node-runtime.json");

/**
 * Download a file from URL to destination
 * @param {string} url
 * @param {string} dest
 * @returns {Promise<void>}
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading: ${url}`);
    const file = fs.createWriteStream(dest);

    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
                const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          reject(new Error("Redirect location not found"));
          return;
        }
        file.close();
        fs.unlinkSync(dest);
        downloadFile(redirectUrl, dest).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on("finish", () => {
        file.close();
        console.log(`Downloaded: ${dest}`);
        resolve();
      });
    }).on("error", (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

/**
 * Extract zip file (Windows)
 * Uses tar.exe which is available on Windows 10+ (built-in)
 * @param {string} zipPath
 * @param {string} outputDir
 */
async function extractZip(zipPath, outputDir) {
  console.log(`Extracting: ${zipPath}`);

    if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
            await execAsync(`tar -xf "${zipPath}" -C "${outputDir}"`, {
      windowsHide: true,
    });
    console.log("Extraction complete (using tar)");
  } catch (tarError) {
    console.log("tar extraction failed, trying alternative method...");

        try {
      const originalDir = process.cwd();
      process.chdir(outputDir);
      await execAsync(`tar -xf "${zipPath}"`, { windowsHide: true });
      process.chdir(originalDir);
      console.log("Extraction complete (using tar, alternative method)");
    } catch (altError) {
            throw new Error(
        `Failed to extract zip file. Please install 7-Zip or update to Windows 10+.\n` +
        `Tar error: ${(tarError instanceof Error ? tarError.message : String(tarError))}\n` +
        `Alternative error: ${(altError instanceof Error ? altError.message : String(altError))}`
      );
    }
  }
}

/**
 * Extract tar.gz file (macOS/Linux)
 * @param {string} tarPath
 * @param {string} outputDir
 */
async function extractTarGz(tarPath, outputDir) {
  console.log(`Extracting: ${tarPath}`);
  try {
    await execAsync(`tar -xzf "${tarPath}" -C "${outputDir}"`, {
      windowsHide: true,
    });
    console.log("Extraction complete");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to extract: ${errorMessage}`);
  }
}

/**
 * Main function to download and prepare Node.js
 */
async function main() {
  console.log("\n=== Downloading Node.js Runtime ===");
  console.log(`Target Platform: ${TARGET_PLATFORM}`);
  console.log(`Target Architecture: ${TARGET_ARCH}`);
  console.log(`Node Version: ${NODE_VERSION}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  const desiredMetadata = {
    version: NODE_VERSION,
    platform: TARGET_PLATFORM,
    arch: TARGET_ARCH,
  };

  if (fs.existsSync(OUTPUT_DIR)) {
    if (fs.existsSync(METADATA_PATH)) {
      try {
        const existingMetadata = JSON.parse(
          fs.readFileSync(METADATA_PATH, "utf8"),
        );
        if (
          existingMetadata.version === desiredMetadata.version &&
          existingMetadata.platform === desiredMetadata.platform &&
          existingMetadata.arch === desiredMetadata.arch
        ) {
          console.log("Node.js runtime already exists, skipping download");
          console.log(`Location: ${OUTPUT_DIR}\n`);
          return;
        }
      } catch (error) {
        console.warn(
          "Failed to read runtime metadata; redownloading Node.js runtime",
          error,
        );
      }
    }

    console.log("Removing outdated Node.js runtime...");
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }

  let downloadUrl;
  let fileName;
  let extractedDirName;

  if (TARGET_PLATFORM === "win32") {
    fileName = `node-v${NODE_VERSION}-win-${TARGET_ARCH}.zip`;
    extractedDirName = `node-v${NODE_VERSION}-win-${TARGET_ARCH}`;
    downloadUrl = `https://nodejs.org/dist/v${NODE_VERSION}/${fileName}`;
  } else if (TARGET_PLATFORM === "darwin") {
    fileName = `node-v${NODE_VERSION}-darwin-${TARGET_ARCH}.tar.gz`;
    extractedDirName = `node-v${NODE_VERSION}-darwin-${TARGET_ARCH}`;
    downloadUrl = `https://nodejs.org/dist/v${NODE_VERSION}/${fileName}`;
  } else if (TARGET_PLATFORM === "linux") {
    fileName = `node-v${NODE_VERSION}-linux-${TARGET_ARCH}.tar.gz`;
    extractedDirName = `node-v${NODE_VERSION}-linux-${TARGET_ARCH}`;
    downloadUrl = `https://nodejs.org/dist/v${NODE_VERSION}/${fileName}`;
  } else {
    console.error(`Unsupported platform: ${TARGET_PLATFORM}`);
    process.exit(1);
  }

  const resourcesDir = path.join(repoRoot, "resources");
  if (!fs.existsSync(resourcesDir)) {
    fs.mkdirSync(resourcesDir, { recursive: true });
  }

  const downloadPath = path.join(resourcesDir, fileName);

  try {
    await downloadFile(downloadUrl, downloadPath);

    const tempExtractDir = path.join(resourcesDir, "temp-node");
    if (!fs.existsSync(tempExtractDir)) {
      fs.mkdirSync(tempExtractDir, { recursive: true });
    }

    if (TARGET_PLATFORM === "win32") {
      await extractZip(downloadPath, tempExtractDir);
    } else {
      await extractTarGz(downloadPath, tempExtractDir);
    }

    const extractedPath = path.join(tempExtractDir, extractedDirName);
    if (fs.existsSync(extractedPath)) {
      fs.renameSync(extractedPath, OUTPUT_DIR);
    } else {
      throw new Error(`Extracted directory not found: ${extractedPath}`);
    }

    console.log("Cleaning up temporary files...");
    fs.unlinkSync(downloadPath);
    fs.rmSync(tempExtractDir, { recursive: true, force: true });

    fs.writeFileSync(
      METADATA_PATH,
      JSON.stringify(
        {
          ...desiredMetadata,
          downloadedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );

    console.log("\n✓ Node.js runtime downloaded and prepared successfully");
    console.log(`Location: ${OUTPUT_DIR}\n`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("\n✗ Error downloading Node.js:", errorMessage);
    process.exit(1);
  }
}

main();
