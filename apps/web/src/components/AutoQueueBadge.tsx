// File: apps/web/src/components/AutoQueueBadge.tsx

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

interface AutoQueueBadgeProps {
  count: number;
  onDismiss?: () => void;
}

export function AutoQueueBadge({ count, onDismiss }: AutoQueueBadgeProps) {
  const t = useTranslations("queue");

  if (count === 0) return null;

  return (
    <AnimatePresence>
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        onClick={onDismiss}
        className="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-2.5 py-1 shadow-lg transition-colors hover:bg-[var(--color-accent-strong)]"
        aria-label={t("autoQueuedTracks", { count })}
        title={t("autoQueued")}
      >
        <Sparkles className="h-3 w-3 text-[var(--color-on-accent)]" />
        <span className="text-xs font-semibold text-[var(--color-on-accent)]">
          +{count}
        </span>
      </motion.button>
    </AnimatePresence>
  );
}
