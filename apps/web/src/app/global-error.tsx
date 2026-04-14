// File: apps/web/src/app/global-error.tsx
// Must be 'use client' — replaces the root layout entirely, so it needs its own
// <html>/<body> and cannot call server request-context APIs (getLocale, etc.).

"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#0a0a0a",
          color: "#e0e0e0",
          fontFamily: "sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ maxWidth: 480, textAlign: "center", padding: "2rem" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "1rem" }}>
            Something went wrong
          </h1>
          {error?.digest && (
            <p
              style={{
                fontSize: "0.75rem",
                color: "#888",
                marginBottom: "0.5rem",
              }}
            >
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.75rem 1.5rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#6366f1",
              color: "#fff",
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
