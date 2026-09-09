"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type AnimatedNumberProps = {
  value: string | number | null | undefined;
  format?: (value: number) => string;
  fallback?: string;
  duration?: number;
  className?: string;
};

const defaultFormat = (value: number) => value.toLocaleString("en-IN");

function subscribeToReducedMotion(onChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

export function AnimatedNumber({
  value,
  format = defaultFormat,
  fallback = "Not available",
  duration = 2200,
  className,
}: AnimatedNumberProps) {
  const target = value === null || value === undefined || value === "" ? null : Number(value);
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
  const [animation, setAnimation] = useState({ target, value: target ?? 0 });

  useEffect(() => {
    if (target === null || !Number.isFinite(target)) {
      return;
    }

    if (reducedMotion) {
      return;
    }

    let frame = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setAnimation({
        target,
        value: progress === 1 ? target : target * easedProgress,
      });

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, reducedMotion, target]);

  const displayValue = target === null || !Number.isFinite(target)
    ? null
    : reducedMotion
      ? target
      : animation.target === target
        ? animation.value
        : 0;
  const rendered = displayValue === null ? fallback : format(displayValue);
  return <span className={className}>{rendered}</span>;
}
