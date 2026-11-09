const BOLD_SPAN = /\*\*([^*\n]+?)\*\*/g;

export function parseAiHelpText(value) {
  const text = String(value ?? "");
  const parts = [];
  let cursor = 0;

  for (const match of text.matchAll(BOLD_SPAN)) {
    const start = match.index;
    if (start > cursor) parts.push({ text: text.slice(cursor, start), bold: false });
    parts.push({ text: match[1], bold: true });
    cursor = start + match[0].length;
  }

  if (cursor < text.length || parts.length === 0) {
    parts.push({ text: text.slice(cursor), bold: false });
  }

  return parts;
}
