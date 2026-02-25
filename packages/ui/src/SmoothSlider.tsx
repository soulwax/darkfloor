// File: packages/ui/src/SmoothSlider.tsx

"use client";

import { haptic } from "./utils/haptics";
import { springPresets } from "./utils/spring-animations";
import {
    animate,
    motion,
    useMotionValue,
    type PanInfo,
} from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

interface SmoothSliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  onChangeStart?: () => void;
  onChangeEnd?: (value: number) => void;
  orientation?: "horizontal" | "vertical";
  size?: "sm" | "md" | "lg";
  showThumb?: boolean;
  showGlow?: boolean;
  disabled?: boolean;
  hapticFeedback?: boolean;
  hapticInterval?: number;
  className?: string;
  trackClassName?: string;
  fillClassName?: string;
  thumbClassName?: string;
  ariaLabel?: string;
  ariaValueText?: (value: number) => string;
}

const SIZES = {
  sm: { track: 4, thumb: 12, activeThumb: 16 },
  md: { track: 6, thumb: 16, activeThumb: 22 },
  lg: { track: 8, thumb: 20, activeThumb: 28 },
};

export function SmoothSlider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  onChangeStart,
  onChangeEnd,
  orientation = "horizontal",
  size = "md",
  showThumb = true,
  showGlow = true,
  disabled = false,
  hapticFeedback = true,
  hapticInterval = 50,
  className = "",
  trackClassName = "",
  fillClassName = "",
  thumbClassName = "",
  ariaLabel,
  ariaValueText,
}: SmoothSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const lastHapticTime = useRef(0);
  const lastHapticValue = useRef(value);

  const isVertical = orientation === "vertical";
  const sizeConfig = SIZES[size];

  const normalizedValue = ((value - min) / (max - min)) * 100;
  const motionProgress = useMotionValue(normalizedValue);

  useEffect(() => {
    if (!isDragging) {
      animate(motionProgress, normalizedValue, {
        type: "spring",
        stiffness: 500,
        damping: 40,
        mass: 0.5,
      });
    }
  }, [normalizedValue, isDragging, motionProgress]);

  const triggerHaptic = useCallback(
    (newValue: number) => {
      if (!hapticFeedback) return;

      const now = Date.now();
      const valueDiff = Math.abs(newValue - lastHapticValue.current);
      const stepThreshold = ((max - min) / 100) * 2;

      if (
        now - lastHapticTime.current >= hapticInterval &&
        valueDiff >= stepThreshold
      ) {
        haptic("sliderTick");
        lastHapticTime.current = now;
        lastHapticValue.current = newValue;
      }
    },
    [hapticFeedback, hapticInterval, max, min],
  );

  const calculateValue = useCallback(
    (clientX: number, clientY: number) => {
      if (!trackRef.current) return value;

      const rect = trackRef.current.getBoundingClientRect();
      let percentage: number;

      if (isVertical) {
        const y = clientY - rect.top;
        percentage = 1 - y / rect.height;
      } else {
        const x = clientX - rect.left;
        percentage = x / rect.width;
      }

      percentage = Math.max(0, Math.min(1, percentage));
      let newValue = min + percentage * (max - min);

      if (step > 0) {
        newValue = Math.round(newValue / step) * step;
      }

      return Math.max(min, Math.min(max, newValue));
    },
    [isVertical, max, min, step, value],
  );

  const handleDragStart = useCallback(() => {
    if (disabled) return;
    setIsDragging(true);
    onChangeStart?.();
    if (hapticFeedback) {
      haptic("selection");
    }
  }, [disabled, hapticFeedback, onChangeStart]);

  const handleDrag = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (disabled || !trackRef.current) return;

      const rect = trackRef.current.getBoundingClientRect();
      let percentage: number;

      if (isVertical) {
        const currentY = info.point.y - rect.top;
        percentage = 1 - currentY / rect.height;
      } else {
        const currentX = info.point.x - rect.left;
        percentage = currentX / rect.width;
      }

      percentage = Math.max(0, Math.min(1, percentage));
      motionProgress.set(percentage * 100);

      let newValue = min + percentage * (max - min);
      if (step > 0) {
        newValue = Math.round(newValue / step) * step;
      }
      newValue = Math.max(min, Math.min(max, newValue));

      triggerHaptic(newValue);
      onChange(newValue);
    },
    [disabled, isVertical, max, min, motionProgress, onChange, step, triggerHaptic],
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    if (hapticFeedback) {
      haptic("light");
    }
    onChangeEnd?.(value);
  }, [hapticFeedback, onChangeEnd, value]);

  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.stopPropagation();

      const newValue = calculateValue(e.clientX, e.clientY);
      onChange(newValue);

      if (hapticFeedback) {
        haptic("light");
      }
    },
    [calculateValue, disabled, hapticFeedback, onChange],
  );

  const handleTrackTouch = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.stopPropagation();

      const touch = e.touches[0];
      if (!touch) return;

      const newValue = calculateValue(touch.clientX, touch.clientY);
      motionProgress.set(((newValue - min) / (max - min)) * 100);
      triggerHaptic(newValue);
      onChange(newValue);
    },
    [calculateValue, disabled, max, min, motionProgress, onChange, triggerHaptic],
  );

  const fillStyle = isVertical
    ? { height: `${normalizedValue}%` }
    : { width: `${normalizedValue}%` };

  const thumbPosition = isVertical
    ? { bottom: `${normalizedValue}%`, left: "50%" }
    : { left: `${normalizedValue}%`, top: "50%" };

  const thumbTransform = isVertical
    ? "translate(-50%, 50%)"
    : "translate(-50%, -50%)";

  return (
    <div
      className={`relative ${isVertical ? "h-full" : "w-full"} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div
        ref={trackRef}
        className={`
          relative overflow-hidden rounded-full cursor-pointer
          ${isVertical ? "w-full h-full" : "w-full"}
          ${trackClassName || "slider-track"}
        `}
        style={{
          height: isVertical ? "100%" : sizeConfig.track,
          width: isVertical ? sizeConfig.track : "100%",
        }}
        onClick={handleTrackClick}
        onTouchMove={handleTrackTouch}
        role="slider"
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={ariaValueText?.(value)}
        aria-orientation={orientation}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
      >
        <motion.div
          className={`
            absolute rounded-full
            ${isVertical ? "bottom-0 left-0 right-0" : "top-0 left-0 h-full"}
            ${fillClassName || "bg-gradient-to-r from-[var(--color-slider-fill)] to-[var(--color-accent-strong)]"}
          `}
          style={fillStyle}
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />

        {showGlow && !disabled && (isHovering || isDragging) && (
          <motion.div
            className={`
              absolute rounded-full blur-md opacity-50
              ${isVertical ? "bottom-0 left-0 right-0" : "top-0 left-0 h-full"}
              bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-strong)]
            `}
            style={fillStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: isDragging ? 0.6 : 0.3 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </div>

      {showThumb && (
        <motion.div
          className={`
            absolute rounded-full shadow-lg cursor-grab active:cursor-grabbing
            ${thumbClassName || "bg-white"}
            ${isDragging ? "shadow-xl" : "shadow-md"}
          `}
          style={{
            ...thumbPosition,
            transform: thumbTransform,
            width: isDragging ? sizeConfig.activeThumb : sizeConfig.thumb,
            height: isDragging ? sizeConfig.activeThumb : sizeConfig.thumb,
            zIndex: 10,
          }}
          drag={isVertical ? "y" : "x"}
          dragConstraints={trackRef}
          dragElastic={0}
          dragMomentum={false}
          onDragStart={handleDragStart}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          whileHover={{ scale: disabled ? 1 : 1.15 }}
          whileTap={{ scale: disabled ? 1 : 0.95 }}
          animate={{
            scale: isDragging ? 1.2 : isHovering ? 1.1 : 1,
          }}
          transition={springPresets.snappy}
        >
          {showGlow && !disabled && isDragging && (
            <motion.div
              className="absolute inset-0 rounded-full bg-[var(--color-accent)]"
              initial={{ scale: 1, opacity: 0.4 }}
              animate={{ scale: 1.8, opacity: 0 }}
              transition={{ duration: 0.6, repeat: Infinity }}
            />
          )}
        </motion.div>
      )}
    </div>
  );
}

interface VerticalSliderProps extends Omit<SmoothSliderProps, "orientation"> {
  height?: number | string;
}

export function VerticalSlider({
  height = 128,
  ...props
}: VerticalSliderProps) {
  return (
    <div style={{ height }}>
      <SmoothSlider {...props} orientation="vertical" />
    </div>
  );
}

export default SmoothSlider;
