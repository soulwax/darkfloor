// File: apps/web/src/components/BottomSheet.tsx

"use client";

import { hapticLight, hapticMedium } from "@/utils/haptics";
import { springPresets } from "@/utils/spring-animations";
import {
    AnimatePresence,
    motion,
    useMotionValue,
    useTransform,
    type PanInfo,
} from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  snapPoints?: number[];
  initialSnap?: number;
  showHandle?: boolean;
  showCloseButton?: boolean;
  dismissible?: boolean;
  className?: string;
}

export default function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  snapPoints = [50, 90],
  initialSnap = 0,
  showHandle = true,
  showCloseButton = true,
  dismissible = true,
  className = "",
}: BottomSheetProps) {
  const constraintsRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [currentSnapIndex, setCurrentSnapIndex] = useState(initialSnap);

  const sheetHeight = useMotionValue(snapPoints[initialSnap] ?? 50);
  const y = useMotionValue(0);

  const heightStyle = useTransform(sheetHeight, (h) => `${h}vh`);

  // Sync sheet state when opened - intentional initialization
  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: reset state on open */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";

      sheetHeight.set(snapPoints[initialSnap] ?? 50);
      setCurrentSnapIndex(initialSnap);
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, initialSnap, snapPoints, sheetHeight]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    const currentHeight = sheetHeight.get();
    const dragVelocity = info.velocity.y;
    const dragOffset = info.offset.y;

    const viewportHeight =
      typeof window !== "undefined" ? window.innerHeight : 800;
    const percentageChange = (dragOffset / viewportHeight) * 100;
    const targetHeight = currentHeight - percentageChange;

    if (
      dismissible &&
      (dragVelocity > 500 || (dragOffset > 100 && targetHeight < 20))
    ) {
      hapticLight();
      onClose();
      return;
    }

    let nearestSnap = snapPoints[0] ?? 50;
    let nearestDistance = Infinity;
    let nearestSnapIndex = 0;

    snapPoints.forEach((snap, index) => {
      const distance = Math.abs(targetHeight - snap);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestSnap = snap;
        nearestSnapIndex = index;
      }
    });

    let nextSnapIndex = nearestSnapIndex;
    if (Math.abs(dragVelocity) > 300) {
      if (dragVelocity < 0) {
        nextSnapIndex = Math.min(nearestSnapIndex + 1, snapPoints.length - 1);
      } else if (dragVelocity > 0) {
        nextSnapIndex = Math.max(nearestSnapIndex - 1, 0);
      }

      if (nextSnapIndex !== nearestSnapIndex) {
        hapticLight();
      }
    }

    const nextSnap = snapPoints[nextSnapIndex] ?? nearestSnap;
    setCurrentSnapIndex(nextSnapIndex);
    sheetHeight.set(nextSnap);
    y.set(0);
  };

  const handleBackdropClick = () => {
    if (dismissible) {
      hapticLight();
      onClose();
    }
  };

  const handleExpandToMax = () => {
    const maxSnap = snapPoints[snapPoints.length - 1] ?? 90;
    hapticMedium();
    sheetHeight.set(maxSnap);
    setCurrentSnapIndex(snapPoints.length - 1);
  };

  const showHeader = Boolean(title) || showCloseButton;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleBackdropClick}
            className="theme-chrome-backdrop fixed inset-0 z-[99] backdrop-blur-sm"
          />

          {}
          <div
            ref={constraintsRef}
            className="pointer-events-none fixed inset-x-0 top-0 bottom-0 z-[100]"
          >
            <motion.div
              ref={sheetRef}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={springPresets.gentle}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.05, bottom: 0.15 }}
              onDragEnd={handleDragEnd}
              style={{
                height: heightStyle,
                y,
              }}
              className={`theme-chrome-drawer pointer-events-auto absolute right-0 bottom-0 left-0 flex flex-col overflow-hidden rounded-t-3xl border-t backdrop-blur-xl ${className}`}
            >
              {}
              {showHandle && (
                <div
                  className="flex cursor-grab touch-none flex-col items-center pt-4 pb-2 active:cursor-grabbing"
                  onDoubleClick={handleExpandToMax}
                >
                  <div className="h-1.5 w-12 rounded-full bg-[rgba(255,255,255,0.25)] transition-colors hover:bg-[rgba(255,255,255,0.4)]" />
                </div>
              )}

              {}
              {showHeader && (
                <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 pt-2 pb-4">
                  {title && (
                    <h2 className="text-xl font-bold text-[var(--color-text)]">
                      {title}
                    </h2>
                  )}
                  {showCloseButton && (
                    <motion.button
                      onClick={() => {
                        hapticLight();
                        onClose();
                      }}
                      whileTap={{ scale: 0.9 }}
                      transition={springPresets.immediate}
                      className="touch-target rounded-full p-2 text-[var(--color-subtext)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
                      aria-label="Close"
                    >
                      <X className="h-5 w-5" />
                    </motion.button>
                  )}
                </div>
              )}

              {}
              <div className="scrollbar-hide pb-safe flex-1 overflow-y-auto overscroll-contain px-6">
                {children}
              </div>

              {}
              {snapPoints.length > 1 && (
                <div className="absolute top-1/2 right-4 flex -translate-y-1/2 flex-col gap-1">
                  {snapPoints.map((snap, index) => (
                    <motion.button
                      key={snap}
                      onClick={() => {
                        hapticLight();
                        sheetHeight.set(snap);
                        setCurrentSnapIndex(index);
                      }}
                      className={`h-1.5 w-1.5 rounded-full transition-all ${
                        currentSnapIndex === index
                          ? "w-3 bg-[var(--color-accent)]"
                          : "bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-hover)]"
                      }`}
                      whileTap={{ scale: 0.8 }}
                      aria-label={`Snap to ${snap}%`}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

export function useBottomSheet(initialState = false) {
  const [isOpen, setIsOpen] = useState(initialState);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen(!isOpen);

  return { isOpen, open, close, toggle, setIsOpen };
}
