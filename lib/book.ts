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
  const page = (kind: BookPageKind, eyebrow: string, title: string, body: string, photoStart: number, layout: BookPage['layout'], quote?: string): BookPage => ({
    id: crypto.randomUUID(), kind, eyebrow, title, body, quote,
    mediaIds: photos.slice(photoStart, photoStart + (layout === 'collage' ? 4 : 1)).map((item) => item.id), layout,
  });
  const pages: BookPage[] = [
    { id: crypto.randomUUID(), kind: 'cover', eyebrow: 'MÉMOIRE MAISON', title: input.title, body: input.address || (en ? 'A home, a story' : 'Une maison, une histoire'), mediaIds: photos.slice(0, 1).map((item) => item.id), layout: 'full-photo' },
    page('story', en ? 'The beginning' : 'Le commencement', en ? 'The day this became home' : 'Le jour où tout a commencé', memory(0, 'Tout commence par une porte franchie et la sensation qu’un nouveau chapitre peut s’écrire ici.', 'Every story begins with a doorway and the feeling that a new chapter can be written here.'), 1, 'editorial'),
    page('gallery', en ? 'First look' : 'Le premier regard', en ? 'Before it became ours' : 'Avant que ce soit chez nous', memory(1, 'Les premières images gardent intact ce qui nous avait attirés dès le début.', 'The first images preserve what drew us in from the very beginning.'), 2, 'collage'),
    page('quote', en ? 'First memory' : 'Premier souvenir', en ? 'The moment we remember' : 'L’instant dont on se souvient', memory(2, 'Un premier souvenir suffit parfois à faire renaître toute une maison.', 'Sometimes one first memory is enough to bring an entire home back.'), 5, 'split', memory(2, '« C’est ici que notre histoire a vraiment commencé. »', '“This is where our story truly began.”')),
    page('story', en ? 'A favourite place' : 'Un endroit aimé', en ? 'Our favourite corner' : 'Notre coin préféré', memory(3, 'Il y avait un endroit où l’on revenait toujours, sans même y penser.', 'There was one place we always returned to without even thinking.'), 6, 'full-photo'),
    page('gallery', en ? 'Everyday life' : 'Le quotidien', en ? 'The beauty of ordinary days' : 'La beauté des jours ordinaires', memory(3, 'Les gestes familiers et les petits détails ont composé la vraie vie de la maison.', 'Familiar rituals and small details made up the true life of the home.'), 7, 'collage'),
    page('story', en ? 'Together' : 'Tous ensemble', en ? 'The moments we return to' : 'Les moments qui nous reviennent', memory(4, 'Certains instants restent très précis, comme s’ils venaient d’avoir lieu.', 'Some moments remain perfectly clear, as though they happened yesterday.'), 10, 'editorial'),
    page('quote', en ? 'Family life' : 'La vie de famille', en ? 'Around the table' : 'Autour de la table', memory(4, 'Les conversations, les repas et les rires ont donné leur rythme aux années.', 'Conversations, meals and laughter gave the years their rhythm.'), 11, 'split', memory(4, '« Les plus beaux moments n’étaient jamais planifiés. »', '“The best moments were never planned.”')),
    page('gallery', en ? 'Celebrations' : 'Les célébrations', en ? 'Days worth keeping' : 'Les jours à garder', memory(5, 'Les fêtes et les occasions spéciales ont laissé des images que l’on aime retrouver.', 'Celebrations and special occasions left images we love to revisit.'), 12, 'collage'),
    page('story', en ? 'A story to tell' : 'Une histoire à raconter', en ? 'The one that still makes us smile' : 'Celle qui nous fait encore sourire', memory(6, 'Chaque maison possède une anecdote que la famille raconte toujours de la même façon.', 'Every home holds a story the family always tells the same way.'), 15, 'editorial'),
    page('gallery', en ? 'Small details' : 'Les petits détails', en ? 'What made it ours' : 'Ce qui la rendait unique', memory(6, 'Une poignée de porte, une lumière en fin de journée, un objet resté à la même place.', 'A door handle, late-afternoon light, an object that always stayed in the same place.'), 16, 'collage'),
    page('story', en ? 'Through the seasons' : 'Au fil des saisons', en ? 'A home in every season' : 'Une maison pour chaque saison', memory(7, 'La maison ne se racontait jamais tout à fait de la même façon selon la saison.', 'The home never told quite the same story from one season to the next.'), 19, 'full-photo'),
    page('timeline', en ? 'A changing home' : 'Une maison qui évolue', en ? 'Growing with us' : 'Grandir avec nous', memory(7, 'La maison a changé à notre rythme, accueillant chaque nouvelle étape.', 'The home changed at our pace, welcoming every new chapter.'), 20, 'collage'),
    page('story', en ? 'Then and now' : 'Avant et maintenant', en ? 'Everything that changed' : 'Tout ce qui a changé', memory(7, 'Les transformations racontent elles aussi le temps passé entre ces murs.', 'The changes tell their own story of the time spent within these walls.'), 23, 'split'),
    page('gallery', en ? 'Our people' : 'Ceux qu’on aime', en ? 'Everyone who made it home' : 'Tous ceux qui en ont fait un foyer', memory(4, 'Un foyer se reconnaît surtout aux personnes qui l’ont rempli de vie.', 'A home is best remembered through the people who filled it with life.'), 24, 'collage'),
    page('story', en ? 'Quiet moments' : 'Les moments calmes', en ? 'When the house was still' : 'Quand la maison était calme', memory(3, 'Il y avait aussi les matins tranquilles et les fins de journée sans programme.', 'There were quiet mornings too, and evenings with nowhere else to be.'), 27, 'minimal'),
    page('gallery', en ? 'Outside' : 'Dehors', en ? 'Beyond the front door' : 'De l’autre côté de la porte', memory(3, 'Le jardin, la rue et le quartier faisaient eux aussi partie de l’histoire.', 'The garden, the street and the neighbourhood were part of the story too.'), 28, 'collage'),
    page('story', en ? 'Sounds and voices' : 'Les sons et les voix', en ? 'What photographs cannot hold' : 'Ce que les photos ne disent pas', memory(4, 'Les voix, les sons familiers et les mots racontent une autre part du souvenir.', 'Voices, familiar sounds and words preserve another part of the memory.'), 31, 'editorial'),
    { id: crypto.randomUUID(), kind: 'interactive', eyebrow: en ? 'Living memories' : 'Souvenirs vivants', title: en ? 'See it. Hear it. Remember it.' : 'Voir, écouter, se souvenir.', body: interactive.length ? (en ? 'Scan the private link to watch the films and listen to the voices connected to this story.' : 'Scannez le lien privé pour retrouver les films et les voix liés à cette histoire.') : (en ? 'Photos, films and voices can be added to the private family space at any time.' : 'Photos, films et voix pourront être ajoutés à tout moment dans l’espace privé de la famille.'), mediaIds: interactive.map((item) => item.id), layout: 'minimal' },
    page('quote', en ? 'What remains' : 'Ce qui reste', en ? 'What we will miss most' : 'Ce qui nous manquera le plus', memory(8, 'Ce sont souvent les détails les plus simples qui nous manquent en premier.', 'It is often the simplest details we miss first.'), 32, 'split', memory(8, '« On quitte une adresse, jamais tout à fait un foyer. »', '“We leave an address, but never quite leave a home.”')),
    page('gallery', en ? 'One last look' : 'Un dernier regard', en ? 'Before turning the page' : 'Avant de tourner la page', memory(8, 'Un dernier tour de la maison pour emporter avec nous ce que les cartons ne contiennent pas.', 'One last walk through the home to carry what no moving box can hold.'), 33, 'collage'),
    page('story', en ? 'In our own words' : 'Avec nos mots', en ? 'The story in one sentence' : 'Toute l’histoire en une phrase', memory(9, 'Une maison change, mais l’histoire qu’on y a vécue reste.', 'A home changes, but the story lived there remains.'), 36, 'minimal'),
    page('quote', en ? 'A letter to our home' : 'Une lettre à notre maison', en ? 'Thank you for these years' : 'Merci pour toutes ces années', memory(9, 'Merci d’avoir abrité les jours ordinaires comme les grands moments.', 'Thank you for holding the ordinary days as carefully as the milestones.'), 37, 'editorial', memory(9, '« Une adresse change. Une histoire reste. »', '“An address changes. A story remains.”')),
    page('story', en ? 'The next chapter' : 'Le prochain chapitre', en ? 'A new story begins' : 'Une nouvelle histoire commence', memory(8, 'La maison continue son chemin, et nous continuons le nôtre avec tous ces souvenirs.', 'The home continues its journey, and we continue ours with every memory.'), 38, 'full-photo'),
    page('closing', en ? 'Mémoire Maison' : 'Mémoire Maison', en ? 'The story stays with us.' : 'L’histoire reste avec nous.', memory(9, 'Ce livre garde la trace d’un lieu, d’une époque et de tout ce qui comptait.', 'This book keeps the trace of a place, a time, and everything that mattered.'), 39, 'minimal'),
  ];
  return { id, projectId: input.projectId, locale: input.locale, title: input.title, subtitle: input.subtitle, address: input.address, collection: input.collection, coverColor: input.coverColor, version: 1, status: 'ready', pages, media: input.media, createdAt: now, updatedAt: now };
}
