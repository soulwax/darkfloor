// File: apps/web/src/components/SuppressExtensionErrors.tsx

"use client";

import { useEffect } from "react";

const SUPPRESS_EXTENSION_ERRORS_MARK = Symbol.for(
  "starchildmusic.suppress-extension-errors",
);

export default function SuppressExtensionErrors() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const originalError = console.error;

    if (typeof originalError !== "function") {
      return;
    }

    // Avoid stacking wrappers (StrictMode/Fast Refresh) and avoid clobbering
    // other tooling that patches console.error (e.g. Next.js dev overlay).
    if ((originalError as unknown as Record<symbol, unknown>)[
      SUPPRESS_EXTENSION_ERRORS_MARK
    ]) {
      return;
    }

    const wrappedError: typeof console.error = function (...args: unknown[]) {
      try {
        const firstArg = args[0];
        if (
          typeof firstArg === "string" &&
          firstArg.includes(
            "Promised response from onMessage listener went out of scope",
          )
        ) {
          return;
        }

        // Temporarily restore to avoid wrapper cycles (e.g. Next dev overlay,
        // other libraries, or extensions that call console.error internally).
        const previousError = console.error;
        console.error = originalError;
        try {
          originalError.apply(console, args);
        } finally {
          if (console.error === originalError) {
            console.error = previousError;
          }
        }
      } catch {
        try {
          const previousError = console.error;
          console.error = originalError;
          try {
            Function.prototype.apply.call(originalError, console, args);
          } finally {
            if (console.error === originalError) {
              console.error = previousError;
            }
          }
        } catch {
        }
      }
    };

    (wrappedError as unknown as Record<symbol, unknown>)[
      SUPPRESS_EXTENSION_ERRORS_MARK
    ] = true;

    console.error = wrappedError;

    return () => {
      // Only restore if our wrapper is still installed.
      if (console.error === wrappedError) {
        console.error = originalError;
      }
    };
  }, []);

  return null;
}
