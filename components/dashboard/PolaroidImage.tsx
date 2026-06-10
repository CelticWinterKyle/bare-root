"use client";

import { useState } from "react";
import { pexelsThumb } from "@/lib/pexels-thumb";

/**
 * Dashboard journal polaroid image. Keeps the bespoke polaroid look (category
 * gradient background + emoji fallback) but loads the photo with a plain <img>
 * + no-referrer so Wikipedia/Perenual don't hotlink-block it, and falls back
 * to the emoji on a failed load (not just a null URL). The CSS class names are
 * passed in so this stays a thin client wrapper over the dashboard's styles.
 */
export function PolaroidImage({
  imageUrl,
  name,
  gradientClass,
  emoji,
  imgWrapClass,
  fallbackClass,
}: {
  imageUrl: string | null;
  name: string;
  gradientClass: string;
  emoji: string;
  imgWrapClass: string;
  fallbackClass: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`${imgWrapClass} ${gradientClass}`}>
      {imageUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          // Polaroids render ~250px wide (4-col journal grid) — 600 covers 2x.
          src={pexelsThumb(imageUrl, 600)}
          alt={name}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={fallbackClass}>{emoji}</span>
      )}
    </div>
  );
}
