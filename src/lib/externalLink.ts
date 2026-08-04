/** Decode HTML entities in RSS URLs and open safely in a new tab. */
export function normalizeExternalUrl(url: string): string {
  if (!url) return '';
  return url.replace(/&amp;/g, '&').trim();
}

export function openExternalUrl(url: string): void {
  const normalized = normalizeExternalUrl(url);
  if (!normalized) return;
  window.open(normalized, '_blank', 'noopener,noreferrer');
}
