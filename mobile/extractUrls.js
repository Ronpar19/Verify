// extractUrls.js
//
// Pulls every URL-looking substring out of a block of pasted text (handy
// when someone pastes a whole SMS instead of just the link, and the SMS
// contains more than one link).
//
// Priority: explicit links (a scheme like https:// or a www. prefix) are
// trusted first. The loose "bare domain" pattern (e.g. "amazon-verify.tk")
// is only used as a last resort, and only when NO explicit link was found
// anywhere in the message — same role it played when this app only ever
// checked a single link, just applied to the whole message now instead of
// stopping at the first hit. This keeps ordinary prose (an email address,
// an abbreviation with a period) from being misread as a second "link"
// whenever a real link is already present.
//
// Returns an array of cleaned, deduplicated URLs in the order they first
// appear in the text. Returns [] if none are found.

function collect(text, regex) {
  const re = new RegExp(regex.source, 'gi');
  const hits = [];
  let match;
  while ((match = re.exec(text)) !== null) {
    const cleaned = match[0].replace(/[),.;!?]+$/, '');
    if (cleaned) hits.push({ start: match.index, url: cleaned });
    if (match[0].length === 0) re.lastIndex++; // safety net, these patterns can't actually match empty
  }
  return hits;
}

export function extractUrls(rawText) {
  if (!rawText) return [];
  const text = rawText.trim();
  if (!text) return [];

  let hits = collect(text, /https?:\/\/[^\s]+/i);

  const wwwHits = collect(text, /www\.[^\s]+\.[a-z]{2,}(?:\/[^\s]*)?/i);
  for (const w of wwwHits) {
    const overlapsExisting = hits.some((h) => w.start >= h.start && w.start < h.start + h.url.length);
    if (!overlapsExisting) hits.push(w);
  }

  if (hits.length === 0) {
    hits = collect(text, /\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}(?:\/[^\s]*)?/i);
  }

  hits.sort((a, b) => a.start - b.start);

  const seen = new Set();
  const unique = [];
  for (const h of hits) {
    const key = h.url.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(h.url);
    }
  }
  return unique;
}

// Convenience helper for anything that only ever wants the first link.
export function extractUrl(text) {
  const all = extractUrls(text);
  return all.length ? all[0] : null;
}
