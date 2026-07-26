// ─────────────────────────────────────────────────────────
// Shared region labels — ISO 3166-1 alpha-2 → display name
// ─────────────────────────────────────────────────────────

export const REGION_LABELS: Record<string, string> = {
  JP: '🇯🇵 Japan',
  US: '🇺🇸 United States',
  GB: '🇬🇧 United Kingdom',
  IN: '🇮🇳 India',
  AU: '🇦🇺 Australia',
  DE: '🇩🇪 Germany',
  FR: '🇫🇷 France',
}

/** Get a human-readable label for a region code, with flag emoji. Falls back to the raw code. */
export function getRegionLabel(code: string): string {
  return REGION_LABELS[code] ?? code
}

/** Region entries as an array — useful for <select> dropdowns. */
export const REGION_ENTRIES = Object.entries(REGION_LABELS).map(([code, name]) => ({
  code,
  name,
}))
