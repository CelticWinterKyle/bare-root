"use client";

import { useState } from "react";
import {
  Carrot,
  Apple,
  Leaf,
  Flower2,
  TreePine,
  Trees,
  Sprout,
  type LucideIcon,
} from "lucide-react";

/**
 * Per-category fallback visuals. Tints/accents track the library's
 * CATEGORY_STYLE (PlantSearch) so the icon tile reads as part of the same
 * system, not a placeholder. Icons are lucide (already a dependency).
 */
const CATEGORY_VISUAL: Record<string, { accent: string; tint: string; Icon: LucideIcon }> = {
  VEGETABLE: { accent: "#3A6B20", tint: "#E4F0D4", Icon: Carrot },
  FRUIT:     { accent: "#7A2A18", tint: "#FBE8E4", Icon: Apple },
  HERB:      { accent: "#3A6B20", tint: "#E0EDCC", Icon: Leaf },
  FLOWER:    { accent: "#5A2A7A", tint: "#EDE4F8", Icon: Flower2 },
  TREE:      { accent: "#3D2A0E", tint: "#F0EAD8", Icon: TreePine },
  SHRUB:     { accent: "#1A3D2A", tint: "#D4EBE0", Icon: Trees },
  OTHER:     { accent: "#3A3A30", tint: "#EAEAE0", Icon: Sprout },
};

/**
 * Plant thumbnail with a graceful, on-brand fallback. Renders the real image
 * (plain <img> + no-referrer so Wikipedia/Perenual don't hotlink-block it),
 * and on a missing or failed image shows a category-tinted tile with a lucide
 * icon instead of a blank square. Fills its parent — the parent sets size and
 * rounding and should be `position: relative; overflow: hidden`.
 */
export function PlantThumb({
  src,
  category,
  name = "",
  className = "",
}: {
  src?: string | null;
  category: string;
  name?: string;
  /** Extra classes for the <img> (e.g. hover scale). */
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const v = CATEGORY_VISUAL[category] ?? CATEGORY_VISUAL.OTHER;
  const Icon = v.Icon;

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setFailed(true)}
        className={`absolute inset-0 w-full h-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: v.tint }}
      aria-label={name || undefined}
    >
      <Icon
        aria-hidden
        strokeWidth={1.5}
        style={{ color: v.accent, width: "42%", height: "42%", opacity: 0.9 }}
      />
    </div>
  );
}
