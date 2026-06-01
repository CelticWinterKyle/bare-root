import { put } from "@vercel/blob";

// Wikimedia (and many image hosts) reject requests without a descriptive
// User-Agent, so set one on every outbound fetch.
const UA = "BareRoot/1.0 (https://bareroot.garden; kyle@celticwinter.com)";

function titleVariants(name: string): string[] {
  const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
  const cap = name.charAt(0).toUpperCase() + name.slice(1);
  return Array.from(new Set([name, cap, titleCase(name)]));
}

/**
 * Find a fresh, working Wikipedia lead-image URL (~640px+) for a plant name.
 * Uses the MediaWiki action API (pageimages) live rather than trusting a
 * previously-stored thumbnail URL — stored Wikimedia thumbs we cached have
 * since gone stale (404/400), but a fresh API lookup returns a valid URL.
 * Returns the source URL (still third-party — re-host it before storing).
 */
export async function findWikipediaImageUrl(name: string): Promise<string | null> {
  for (const variant of titleVariants(name)) {
    try {
      const res = await fetch(
        "https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=thumbnail" +
          `&pithumbsize=640&format=json&redirects=1&titles=${encodeURIComponent(variant)}`,
        { headers: { "User-Agent": UA } }
      );
      if (!res.ok) continue;
      const data = (await res.json()) as {
        query?: { pages?: Record<string, { thumbnail?: { source?: string } }> };
      };
      const pages = data.query?.pages ?? {};
      for (const page of Object.values(pages)) {
        const src = page.thumbnail?.source;
        if (src) return src;
      }
    } catch {
      // try the next title variant
    }
    await new Promise((r) => setTimeout(r, 60));
  }
  return null;
}

/**
 * Download an image and store a durable copy in Vercel Blob, returning the
 * Blob URL (or null on any failure). The whole point of re-hosting: never
 * depend on a third-party image URL at render time — they expire (Perenual's
 * presigned S3 links last 24h), move, or hotlink-block.
 */
export async function rehostImageToBlob(
  sourceUrl: string,
  plantId: string
): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.byteLength < 500) return null; // guard against tiny error pages
    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
      ? "webp"
      : "jpg";
    const blob = await put(`plants/${plantId}.${ext}`, bytes, {
      access: "public",
      contentType,
      allowOverwrite: true,
    });
    return blob.url;
  } catch {
    return null;
  }
}

/** True if a URL is already a durable Blob copy (so it never needs re-hosting). */
export function isBlobUrl(url: string | null | undefined): boolean {
  return !!url && url.includes(".blob.vercel-storage.com");
}

/** Find a Wikipedia image for a plant and re-host it to Blob in one step. */
export async function sourceAndRehostImage(
  plantId: string,
  name: string
): Promise<string | null> {
  const src = await findWikipediaImageUrl(name);
  if (!src) return null;
  return rehostImageToBlob(src, plantId);
}
