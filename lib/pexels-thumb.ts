/**
 * Stored Pexels URLs are the `large` size (~100-300KB) but mostly render as
 * small thumbs. The Pexels CDN resizes on the fly via query params, so ask
 * for a compressed, width-capped variant. Non-Pexels URLs (Wikipedia,
 * Perenual, user uploads) pass through untouched.
 */
export function pexelsThumb(url: string, width = 400): string {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return url;
  }
  if (hostname !== "images.pexels.com") return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}auto=compress&cs=tinysrgb&w=${width}`;
}
