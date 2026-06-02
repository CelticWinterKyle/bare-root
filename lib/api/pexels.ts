// Pexels search → a stable, hotlink-friendly image URL for a plant.
//
// Pexels image URLs are permanent CDN links (unlike Perenual's 24h presigned
// S3 URLs that expire), so we store them directly — no re-hosting needed. The
// search appends a category context word ("basil herb", "carrot vegetable") so
// results are the plant/produce rather than a prepared dish.

const CATEGORY_QUERY: Record<string, string> = {
  VEGETABLE: "vegetable",
  FRUIT: "fruit",
  HERB: "herb",
  FLOWER: "flower",
  TREE: "tree",
  SHRUB: "plant",
  OTHER: "plant",
};

/**
 * Find a high-quality Pexels photo URL for a plant. Returns the ~940px `large`
 * src of the top landscape result, or null (no key / no result / error).
 */
export async function findPexelsImageUrl(
  name: string,
  category: string
): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;

  const context = CATEGORY_QUERY[category] ?? "plant";
  const query = `${name} ${context}`.trim();

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}` +
        `&per_page=1&orientation=landscape`,
      { headers: { Authorization: key } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      photos?: { src?: { large?: string } }[];
    };
    return data.photos?.[0]?.src?.large ?? null;
  } catch {
    return null;
  }
}

/** True if a URL is already a Pexels CDN image (so we can skip re-sourcing it). */
export function isPexelsUrl(url: string | null | undefined): boolean {
  return !!url && url.includes("images.pexels.com");
}
