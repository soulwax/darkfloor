// File: apps/web/src/components/ChangelogModal.tsx

"use client";

import { springPresets } from "@/utils/spring-animations";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState, type ReactElement } from "react";

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CHANGELOG_ENDPOINTS = ["/CHANGELOG.md", "/api/v2/changelog"] as const;
const HTML_RESPONSE_PATTERN = /^\s*<(?:!doctype html|html|head|body)\b/i;
const CHANGELOG_UNAVAILABLE_MESSAGE =
  "Changelog is currently unavailable. Please try again shortly.";

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function looksLikeHtmlDocument(payload: string): boolean {
  return HTML_RESPONSE_PATTERN.test(payload);
}

function extractMarkdownFromJsonPayload(payload: string): string | null {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (typeof parsed === "string" && parsed.trim().length > 0) {
      return parsed;
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      "changelog" in parsed &&
      typeof parsed.changelog === "string" &&
      parsed.changelog.trim().length > 0
    ) {
      return parsed.changelog;
    }
  } catch {
    return null;
  }

  return null;
}

async function fetchChangelogFromSource(
  source: string,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(source, { cache: "no-store", signal });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const payload = await response.text();
  if (payload.trim().length === 0) {
    throw new Error("Response body was empty");
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("text/html") || looksLikeHtmlDocument(payload)) {
    throw new Error("Received HTML response instead of markdown");
  }

  if (contentType.includes("application/json")) {
    const extractedMarkdown = extractMarkdownFromJsonPayload(payload);
    if (extractedMarkdown) {
      return extractedMarkdown;
    }
  }

  return payload;
}

async function fetchChangelog(signal: AbortSignal): Promise<string> {
  let lastError: Error | null = null;

  for (const source of CHANGELOG_ENDPOINTS) {
    try {
      return await fetchChangelogFromSource(source, signal);
    } catch (error) {
      if (isAbortError(error)) throw error;
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error("No changelog sources are available");
}

export default function ChangelogModal({
  isOpen,
  onClose,
}: ChangelogModalProps) {
  const [changelogContent, setChangelogContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();
    setLoading(true);

    void fetchChangelog(controller.signal)
      .then((markdown) => {
        if (controller.signal.aborted) return;
        setChangelogContent(markdown);
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        console.error("Failed to load changelog:", error);
        setChangelogContent(CHANGELOG_UNAVAILABLE_MESSAGE);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [isOpen]);

  const parseChangelog = (content: string) => {
    const lines = content.split("\n");
    const elements: ReactElement[] = [];
    let key = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      if (line.startsWith("## ")) {
        elements.push(
          <h2
            key={key++}
            className="mb-3 mt-6 text-xl font-bold text-[var(--color-accent)] first:mt-0 md:text-2xl"
          >
            {line.substring(3)}
          </h2>,
        );
      } else if (line.startsWith("### ")) {
        elements.push(
          <h3
            key={key++}
            className="mb-2 mt-4 text-lg font-semibold text-[var(--color-text)] md:text-xl"
          >
            {line.substring(4)}
          </h3>,
        );
      } else if (line.startsWith("#### ")) {
        elements.push(
          <h4
            key={key++}
            className="mb-2 mt-3 text-base font-semibold text-[var(--color-text)] md:text-lg"
          >
            {line.substring(5)}
          </h4>,
        );
      } else if (line.startsWith("- ")) {
        elements.push(
          <li
            key={key++}
            className="ml-4 text-sm text-[var(--color-subtext)] md:text-base"
          >
            {line.substring(2)}
          </li>,
        );
      } else if (line.startsWith("```")) {
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i]!.startsWith("```")) {
          codeLines.push(lines[i]!);
          i++;
        }
        elements.push(
          <pre
            key={key++}
            className="my-3 overflow-x-auto rounded-lg bg-[rgba(0,0,0,0.4)] p-3 text-xs md:text-sm"
          >
            <code className="text-[var(--color-accent-light)]">
              {codeLines.join("\n")}
            </code>
          </pre>,
        );
      } else if (line.startsWith("# ")) {
        elements.push(
          <h1
            key={key++}
            className="mb-4 text-2xl font-bold text-[var(--color-text)] md:text-3xl"
          >
            {line.substring(2)}
          </h1>,
        );
      } else if (line.startsWith("**") && line.endsWith("**")) {
        elements.push(
          <p key={key++} className="mb-2 font-semibold text-[var(--color-text)]">
            {line.substring(2, line.length - 2)}
          </p>,
        );
      } else if (line.startsWith("---")) {
        elements.push(
          <hr
            key={key++}
            className="my-6 border-t border-[rgba(255,255,255,0.1)]"
          />,
        );
      } else if (line.trim().length > 0) {
        elements.push(
          <p
            key={key++}
            className="mb-2 text-sm text-[var(--color-subtext)] md:text-base"
          >
            {line}
          </p>,
        );
      }
    }

    return elements;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={springPresets.gentle}
            className="theme-chrome-backdrop fixed inset-0 z-[90] backdrop-blur-sm"
            onClick={onClose}
          />

          {}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={springPresets.gentle}
            className="theme-panel fixed inset-4 z-[91] mx-auto my-auto flex max-h-[90vh] max-w-4xl flex-col overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl md:inset-8"
          >
            {}
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.1)] px-5 py-4 md:px-6">
              <h2 className="text-lg font-bold text-[var(--color-text)] md:text-xl">
                Changelog
              </h2>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(244,178,102,0.1)] text-[var(--color-accent)] transition-all hover:bg-[rgba(244,178,102,0.2)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {}
            <div className="flex-1 overflow-y-auto px-5 py-4 md:px-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="spinner" />
                </div>
              ) : (
                <div className="prose prose-invert max-w-none">
                  {parseChangelog(changelogContent)}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
