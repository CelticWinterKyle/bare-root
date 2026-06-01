/**
 * Escape a string for safe interpolation into HTML (emails, etc.).
 * User-controlled values (garden names, display names, reminder text) must
 * be passed through this before being embedded in an HTML template string.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
