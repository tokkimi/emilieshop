// Format d'impression Lulu : 8,5 × 11 po (21,6 × 27,9 cm), portrait, couverture rigide.
export const PRINT_TRIM = { widthIn: 8.5, heightIn: 11, label: '21,6 × 27,9 cm' } as const;

export type SwatchId = string;

export const COVER_COLORS: { id: SwatchId; label: { fr: string; en: string }; bg: string; ink: string }[] = [
  { id: 'white', label: { fr: 'Blanc', en: 'White' }, bg: '#ffffff', ink: '#1f2723' },
  { id: 'forest', label: { fr: 'Forêt', en: 'Forest' }, bg: '#294439', ink: '#ffffff' },
  { id: 'midnight', label: { fr: 'Nuit', en: 'Midnight' }, bg: '#202d37', ink: '#ffffff' },
  { id: 'clay', label: { fr: 'Terracotta', en: 'Terracotta' }, bg: '#9b5f48', ink: '#ffffff' },
  { id: 'sage', label: { fr: 'Sauge', en: 'Sage' }, bg: '#dfe6dd', ink: '#1f2723' },
  { id: 'black', label: { fr: 'Noir', en: 'Black' }, bg: '#111111', ink: '#ffffff' },
];

export const PAGE_COLORS: { id: SwatchId; label: { fr: string; en: string }; bg: string; ink: string; soft: string }[] = [
  { id: 'white', label: { fr: 'Blanc', en: 'White' }, bg: '#ffffff', ink: '#1f2723', soft: '#6b7570' },
  { id: 'pearl', label: { fr: 'Gris perle', en: 'Pearl grey' }, bg: '#f3f3f1', ink: '#1f2723', soft: '#6b7570' },
  { id: 'sage', label: { fr: 'Sauge pâle', en: 'Pale sage' }, bg: '#eef2ed', ink: '#1f2723', soft: '#66736b' },
  { id: 'night', label: { fr: 'Nuit', en: 'Night' }, bg: '#1d2630', ink: '#f5f5f2', soft: '#aab4b0' },
];

export function coverColor(id?: string) {
  return COVER_COLORS.find((item) => item.id === id) || COVER_COLORS[0];
}

export function pageColor(id?: string) {
  return PAGE_COLORS.find((item) => item.id === id) || PAGE_COLORS[0];
}
