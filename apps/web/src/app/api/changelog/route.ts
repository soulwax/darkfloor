import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { NextResponse } from "next/server";
import { fileURLToPath } from "node:url";

export const runtime = "nodejs";

const routeDir = dirname(fileURLToPath(import.meta.url));
const CHANGELOG_SOURCES = [
  resolve(routeDir, "../../../../public/CHANGELOG.md"),
  resolve(routeDir, "../../../../../../CHANGELOG.md"),
];

async function loadChangelog(): Promise<string> {
  for (const source of CHANGELOG_SOURCES) {
    try {
      return await readFile(source, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  throw new Error("CHANGELOG.md was not found in the app public directory or repo root.");
}

export async function GET() {
  try {
    const content = await loadChangelog();

    return new NextResponse(content, {
      status: 200,
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/changelog] Failed to load changelog", error);

    return NextResponse.json(
      { error: "Failed to load changelog" },
      { status: 500 },
    );
  }
}
