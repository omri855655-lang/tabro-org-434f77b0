// Decode feed entities as text; never insert the result as HTML.
export function newsText(value: unknown): string {
  const names: Record<string, string> = { amp: '&', quot: '"', apos: "'", nbsp: ' ', lt: '<', gt: '>', rsquo: '\u2019', lsquo: '\u2018', ndash: '\u2013', mdash: '\u2014' };
  return String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, key: string) => {
    if (!key.startsWith('#')) return names[key.toLowerCase()] ?? entity;
    const code = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : entity;
  }).replace(/\s+/g, ' ').trim();
}
