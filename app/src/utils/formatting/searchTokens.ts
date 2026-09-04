/**
 * Search tokens for the food database.
 *
 * Firestore has no full-text search: a prefix query on the whole name only
 * matches from the first character, so "milk" never finds "Amul Taaza Milk".
 * Instead each food carries an array of tokens — every word plus its prefixes —
 * and search does an array-contains lookup on what the user typed.
 *
 * ⚠️ backend/seed/seedOpenFoodFacts.js has a copy of this. They're separate
 * packages, so if you change the rules here, change them there too or seeded
 * foods and user foods will stop matching the same queries.
 */

/** Prefixes shorter than this aren't worth indexing — they match almost everything. */
const MIN_PREFIX = 3;
/** Keeps a long product name from producing a hundred index entries. */
const MAX_TOKENS = 80;

/** Split a name into lowercase words, dropping punctuation. */
export function words(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9%\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Every word in `text`, plus each word's prefixes, capped and de-duplicated. */
export function buildSearchTokens(...text: (string | undefined | null)[]): string[] {
  const out = new Set<string>();
  for (const part of text) {
    for (const word of words(part || '')) {
      if (word.length < MIN_PREFIX) {
        out.add(word); // short words ("2", "xl") are only useful whole
        continue;
      }
      for (let i = MIN_PREFIX; i <= word.length; i++) out.add(word.slice(0, i));
    }
  }
  return Array.from(out).slice(0, MAX_TOKENS);
}

/**
 * The token to look a query up by: the longest word the user typed, since
 * that's the most selective one.
 */
export function queryToken(queryText: string): string | null {
  const list = words(queryText).sort((a, b) => b.length - a.length);
  return list[0] ?? null;
}
