export type BookLocale = 'fr' | 'en';
export type BookPageKind = 'cover' | 'story' | 'gallery' | 'quote' | 'timeline' | 'interactive' | 'closing';
export type BookMedia = {
  id: string;
  name: string;
  kind: 'photo' | 'video' | 'audio';
  previewUrl?: string;
};
export type BookPage = {
  id: string;
  kind: BookPageKind;
  eyebrow?: string;
  title: string;
  body: string;
  quote?: string;
  mediaIds: string[];
  layout: 'editorial' | 'full-photo' | 'split' | 'collage' | 'minimal';
};
export type GeneratedBook = {
  id: string;
  projectId?: string;
  locale: BookLocale;
  title: string;
  subtitle: string;
  address: string;
  collection: string;
  coverColor: string;
  version: number;
  status: 'draft' | 'ready' | 'approved';
  pages: BookPage[];
  media: BookMedia[];
  createdAt: string;
  updatedAt: string;
};

export type BookGenerationInput = {
  projectId?: string;
  locale: BookLocale;
  title: string;
  subtitle: string;
  address: string;
  collection: string;
  coverColor: string;
  answers: Record<string, string>;
  media: BookMedia[];
};

export const BOOK_STORAGE_KEY = 'memoire-maison-current-book';
export const STUDIO_STORAGE_KEY = 'memoire-maison-studio-draft';

export function fallbackBook(input: BookGenerationInput, id = crypto.randomUUID()): GeneratedBook {
  const en = input.locale === 'en';
  const memories = Object.values(input.answers).map((answer) => answer.trim()).filter(Boolean);
  const photos = input.media.filter((item) => item.kind === 'photo');
  const interactive = input.media.filter((item) => item.kind !== 'photo');
  const now = new Date().toISOString();
  const memory = (index: number, fallbackFr: string, fallbackEn: string) => memories[index] || (en ? fallbackEn : fallbackFr);
  const pages: BookPage[] = [
    { id: crypto.randomUUID(), kind: 'cover', eyebrow: 'MÉMOIRE MAISON', title: input.title, body: input.address || (en ? 'A home, a story' : 'Une maison, une histoire'), mediaIds: photos.slice(0, 1).map((item) => item.id), layout: 'full-photo' },
    { id: crypto.randomUUID(), kind: 'story', eyebrow: en ? 'The beginning' : 'Le commencement', title: en ? 'The day this became home' : 'Le jour où tout a commencé', body: memory(0, 'Nous nous souvenons encore de la première fois où nous avons franchi la porte.', 'We still remember the first time we walked through the door.'), mediaIds: photos.slice(1, 2).map((item) => item.id), layout: 'editorial' },
    { id: crypto.randomUUID(), kind: 'quote', eyebrow: en ? 'First impressions' : 'Le premier regard', title: en ? 'What won us over' : 'Ce qui nous a séduits', body: memory(1, 'La lumière, les volumes et cette impression immédiate d’être déjà chez nous.', 'The light, the rooms, and the immediate feeling that we were already home.'), quote: memory(2, '« Ici, les petits instants sont devenus nos plus grands souvenirs. »', '“Here, the smallest moments became our greatest memories.”'), mediaIds: photos.slice(2, 4).map((item) => item.id), layout: 'split' },
    { id: crypto.randomUUID(), kind: 'gallery', eyebrow: en ? 'Life at home' : 'La vie à la maison', title: en ? 'The years between these walls' : 'Les années entre ces murs', body: memory(3, 'Chaque pièce a gardé une trace de notre quotidien et de ceux qui l’ont partagé.', 'Every room kept a trace of our everyday life and the people who shared it.'), mediaIds: photos.slice(4, 8).map((item) => item.id), layout: 'collage' },
    { id: crypto.randomUUID(), kind: 'story', eyebrow: en ? 'Together' : 'Tous ensemble', title: en ? 'The moments we return to' : 'Les moments qui nous reviennent', body: memory(4, 'Les repas qui se prolongeaient, les fêtes, les rires et les dimanches sans programme.', 'Long meals, celebrations, laughter, and Sundays with no plans.'), mediaIds: photos.slice(8, 10).map((item) => item.id), layout: 'editorial' },
    { id: crypto.randomUUID(), kind: 'timeline', eyebrow: en ? 'A changing home' : 'Une maison qui évolue', title: en ? 'Growing with us' : 'Grandir avec nous', body: memory(7, 'La maison a changé à notre rythme, accueillant chaque nouvelle étape de notre famille.', 'The home changed at our pace, welcoming every new chapter of our family.'), mediaIds: photos.slice(10, 14).map((item) => item.id), layout: 'collage' },
    { id: crypto.randomUUID(), kind: 'interactive', eyebrow: en ? 'Living memories' : 'Souvenirs vivants', title: en ? 'See it. Hear it. Remember it.' : 'Voir, écouter, se souvenir.', body: interactive.length ? (en ? 'Scan the private link to watch the films and listen to the voices connected to this story.' : 'Scannez le lien privé pour retrouver les films et les voix liés à cette histoire.') : (en ? 'Photos, films and voices can be added to the private family space at any time.' : 'Photos, films et voix pourront être ajoutés à tout moment dans l’espace privé de la famille.'), mediaIds: interactive.map((item) => item.id), layout: 'minimal' },
    { id: crypto.randomUUID(), kind: 'closing', eyebrow: en ? 'The next chapter' : 'Le prochain chapitre', title: en ? 'The story stays with us.' : 'L’histoire reste avec nous.', body: memory(8, 'La maison change de mains. Tout ce que nous y avons vécu nous accompagne.', 'The house changes hands. Everything we lived here comes with us.'), quote: memory(9, '« Une adresse change. Une histoire reste. »', '“An address changes. A story remains.”'), mediaIds: photos.slice(14, 16).map((item) => item.id), layout: 'minimal' },
  ];
  return { id, projectId: input.projectId, locale: input.locale, title: input.title, subtitle: input.subtitle, address: input.address, collection: input.collection, coverColor: input.coverColor, version: 1, status: 'ready', pages, media: input.media, createdAt: now, updatedAt: now };
}
