// Pexels search → a stable, hotlink-friendly image URL for a plant.
//
// Pexels image URLs are permanent CDN links (unlike Perenual's 24h presigned
// S3 URLs that expire), so we store them directly — no re-hosting needed.
//
// Coverage is maximised with a multi-tier fallback so (nearly) every plant
// gets a photo:
//   1. "{full name} {category}"   e.g. "Genovese Basil herb"   (most specific)
//   2. "{base noun} {category}"   e.g. "Basil herb"            (rescues varieties)
//   3. "{base noun}"              e.g. "Basil"
//   4. a generic category photo, varied per-plant so obscure plants don't all
//      show the same image (last resort — themed, not species-accurate)

const CATEGORY_QUERY: Record<string, string> = {
  VEGETABLE: "vegetable",
  FRUIT: "fruit",
  HERB: "herb",
  FLOWER: "flower",
  TREE: "tree",
  SHRUB: "plant",
  OTHER: "plant",
};

// Tier-4 generic queries — broad enough to always return results.
const GENERIC_QUERY: Record<string, string> = {
  VEGETABLE: "fresh vegetables",
  FRUIT: "fresh fruit",
  HERB: "fresh herbs",
  FLOWER: "garden flowers",
  TREE: "green tree leaves",
  SHRUB: "garden shrub",
  OTHER: "green plant",
};

const GENERIC_POOL = 15;

/** The plant noun is almost always the last word ("Genovese Basil" -> "Basil"). */
function lastWord(name: string): string {
  const parts = name.split(/[\s-]+/).filter(Boolean);
  return parts[parts.length - 1] ?? name;
}

/** Stable pseudo-index from a string, so the generic fallback varies per plant. */
function hashIndex(seed: string, n: number): number {
  if (n <= 0) return 0;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % n;
}

/** One Pexels search; returns the `large` src at `index` (clamped), or null. */
async function pexelsSearch(
  query: string,
  opts: { perPage?: number; index?: number } = {}
): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  const perPage = opts.perPage ?? 1;
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}` +
        `&per_page=${perPage}&orientation=landscape`,
      { headers: { Authorization: key } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { photos?: { src?: { large?: string } }[] };
    const photos = data.photos ?? [];
    if (photos.length === 0) return null;
    const i = Math.min(opts.index ?? 0, photos.length - 1);
    return photos[i]?.src?.large ?? photos[0]?.src?.large ?? null;
  } catch {
    return null;
  }
}

/**
 * Find a high-quality Pexels photo URL for a plant, falling back through
 * progressively broader queries so nearly every plant gets an image.
 */
export async function findPexelsImageUrl(
  name: string,
  category: string
): Promise<string | null> {
  if (!process.env.PEXELS_API_KEY) return null;

  const cat = CATEGORY_QUERY[category] ?? "plant";
  const base = lastWord(name);

  // 1: full name + category context.
  let url = await pexelsSearch(`${name} ${cat}`);
  // 2: base plant noun + category (rescues "Genovese Basil" -> "Basil herb").
  if (!url && base.toLowerCase() !== name.toLowerCase()) {
    url = await pexelsSearch(`${base} ${cat}`);
  }
  // 3: base noun alone.
  if (!url) url = await pexelsSearch(base);
  // 4: generic category photo — varied per plant so the obscure ones don't
  //    all share the same image.
  if (!url) {
    const generic = GENERIC_QUERY[category] ?? "green plant";
    url = await pexelsSearch(generic, { perPage: GENERIC_POOL, index: hashIndex(name, GENERIC_POOL) });
  }
  return url;
}

/** True if a URL is already a Pexels CDN image (so we can skip re-sourcing it). */
export function isPexelsUrl(url: string | null | undefined): boolean {
  return !!url && url.includes("images.pexels.com");
}
