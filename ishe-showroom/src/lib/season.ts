/**
 * Seasonal window dressing. Pieces are existing catalogue SKUs shown again in the shop windows.
 * Festive: Navratri to Diwali; wedding: the winter wedding season; classic otherwise.
 * `?season=festive|wedding|classic` overrides (QA, or to preview another season).
 */
export type Season = 'festive' | 'wedding' | 'classic';

export const SEASON_WINDOWS: Record<Season, { label: string; skus: [string, string] }> = {
  festive: { label: 'Festive windows', skus: ['ISH-N01', 'ISH-E05'] },
  wedding: { label: 'Wedding season windows', skus: ['ISH-N03', 'ISH-E02'] },
  classic: { label: 'Classic windows', skus: ['ISH-N04', 'ISH-P01'] },
};

export function seasonFor(date: Date, override?: string | null): Season {
  if (override === 'festive' || override === 'wedding' || override === 'classic') return override;
  const m = date.getMonth() + 1, d = date.getDate();
  const md = m * 100 + d;
  if (md >= 920 && md <= 1120) return 'festive';
  if (md >= 1121 || md <= 228) return 'wedding';
  return 'classic';
}
