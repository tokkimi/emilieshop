// Print partners a book can be made with. The choice is stored on the project
// as an "printer:<id>" entry in its options, so no schema change is needed.
export type PrinterId = 'mpix' | 'prodigi';

export const PRINTER_IDS: PrinterId[] = ['mpix', 'prodigi'];
const OPTION_PREFIX = 'printer:';

type Localized = { fr: string; en: string };

export type PrinterInfo = {
  id: PrinterId;
  name: string;
  tagline: Localized;
  specs: { label: Localized; value: Localized }[];
  path: Localized;
};

export const PRINTERS: Record<PrinterId, PrinterInfo> = {
  mpix: {
    id: 'mpix',
    name: 'Mpix',
    tagline: { fr: 'Laboratoire photo professionnel, rendu des couleurs très fidèle.', en: 'Professional photo lab with very faithful colour.' },
    specs: [
      { label: { fr: 'Fabrication', en: 'Made in' }, value: { fr: 'Laboratoire Mpix, États-Unis', en: 'Mpix lab, United States' } },
      { label: { fr: 'Couverture', en: 'Cover' }, value: { fr: 'Rigide, photo imprimée', en: 'Hardcover, printed photo' } },
      { label: { fr: 'Papier', en: 'Paper' }, value: { fr: 'Papier photo professionnel', en: 'Professional photo paper' } },
      { label: { fr: 'Envoi', en: 'Sending' }, value: { fr: 'Commande passée par l’équipe Mémoire Maison', en: 'Ordered by the Mémoire Maison team' } },
    ],
    path: { fr: '/atelier/mpix', en: '/en/studio/mpix' },
  },
  prodigi: {
    id: 'prodigi',
    name: 'Prodigi',
    tagline: { fr: 'Réseau d’imprimeurs international, devis en ligne et fabrication après validation.', en: 'International print network, online quotes and production after approval.' },
    specs: [
      { label: { fr: 'Fabrication', en: 'Made in' }, value: { fr: 'Atelier partenaire le plus proche de chez vous', en: 'Partner lab closest to you' } },
      { label: { fr: 'Couverture', en: 'Cover' }, value: { fr: 'Rigide, finition mate', en: 'Hardcover, matte finish' } },
      { label: { fr: 'Papier', en: 'Paper' }, value: { fr: 'Papier couché premium', en: 'Premium coated paper' } },
      { label: { fr: 'Envoi', en: 'Sending' }, value: { fr: 'Après validation des fichiers', en: 'After print-file approval' } },
    ],
    path: { fr: '/atelier/prodigi', en: '/en/studio/prodigi' },
  },
};

export function printerOption(id: PrinterId) {
  return `${OPTION_PREFIX}${id}`;
}

/** The printer recorded on a project, or null for older projects. */
export function printerFromOptions(options: unknown): PrinterId | null {
  if (!Array.isArray(options)) return null;
  for (const option of options) {
    if (typeof option !== 'string' || !option.startsWith(OPTION_PREFIX)) continue;
    const id = option.slice(OPTION_PREFIX.length);
    if ((PRINTER_IDS as string[]).includes(id)) return id as PrinterId;
  }
  return null;
}
