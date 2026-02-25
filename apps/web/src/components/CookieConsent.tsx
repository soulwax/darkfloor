// File: apps/web/src/components/CookieConsent.tsx

"use client";

import { useEffect, useState } from "react";

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Check if user has already accepted cookies
    const hasConsented = localStorage.getItem("cookie-consent");
    if (!hasConsented) {
      // Small delay to avoid flash on initial load
      setTimeout(() => setIsVisible(true), 1000);
    }
  }, []);

  const handleAccept = () => {
    setIsExiting(true);
    setTimeout(() => {
      localStorage.setItem("cookie-consent", "true");
      setIsVisible(false);
    }, 300);
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 z-[9999] transition-all duration-300 md:left-auto md:right-4 md:max-w-md ${
        isExiting
          ? "translate-y-full opacity-0"
          : "translate-y-0 opacity-100"
      }`}
    >
      <div className="rounded-lg border border-gray-700/50 bg-gray-900/95 p-4 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-300">
            We use functional cookies to ensure the best experience on our platform.
            These are essential for the site to work properly.
          </p>
          <button
            onClick={handleAccept}
            className="rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20 active:scale-95"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
