// File: apps/web/src/app/register-sw.tsx

"use client";

import { useEffect, useRef } from "react";

export function RegisterServiceWorker() {
  const hasReloadedRef = useRef(false);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      const handleControllerChange = () => {
        if (hasReloadedRef.current) return;
        hasReloadedRef.current = true;
        window.location.reload();
      };

      navigator.serviceWorker.addEventListener(
        "controllerchange",
        handleControllerChange,
      );

      const activateUpdate = (registration: ServiceWorkerRegistration) => {
        if (!registration.waiting) return;
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      };

      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log(
            "Service Worker registered with scope:",
            registration.scope,
          );
          if (registration.waiting && navigator.serviceWorker.controller) {
            activateUpdate(registration);
          }
          registration.addEventListener("updatefound", () => {
            const installing = registration.installing;
            if (!installing) return;
            installing.addEventListener("statechange", () => {
              if (
                installing.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                activateUpdate(registration);
              }
            });
          });
          registration.update().catch(() => {
            // Update checks can fail if the user goes offline.
          });
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error);
        });

      return () => {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          handleControllerChange,
        );
      };
    }
  }, []);

  return null;
}
