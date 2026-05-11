"use client";

// Animated score digit. Renders a tabular-num span and flashes when
// the value changes — used on the live-match screen to make goals
// land visually instead of silently swapping a digit.
//
// The animation: a quick scale-up + primary tint, settling back in
// ~700ms. Honours `prefers-reduced-motion` by degrading to a colour-
// only flash with no scale.

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const FLASH_MS = 700;

interface AnimatedScoreProps {
  value: number;
  className?: string;
}

export function AnimatedScore({ value, className }: AnimatedScoreProps) {
  // React-recommended pattern for "react to a prop change": compare
  // tracked-prev vs current during render and call setState then —
  // avoids the cascading-effect anti-pattern of doing it in useEffect.
  const [prev, setPrev] = useState(value);
  const [flash, setFlash] = useState(false);

  if (value !== prev) {
    setPrev(value);
    setFlash(true);
  }

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(false), FLASH_MS);
    return () => clearTimeout(id);
  }, [flash]);

  return (
    <span
      className={cn(
        "inline-block tabular-nums transition-all duration-500 ease-out",
        flash && ["text-primary scale-125", "motion-reduce:scale-100"],
        className,
      )}
    >
      {value}
    </span>
  );
}
