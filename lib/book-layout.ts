import type { BookMedia, GeneratedBook } from './book';

export function placePhotosOnPage(book: GeneratedBook, pageIndex: number, ids: string[], slot = 0): GeneratedBook {
  const page = book.pages[pageIndex];
  if (!page || page.kind === 'interactive') return book;
  const valid = new Set(book.media.filter((item) => item.kind === 'photo').map((item) => item.id));
  const capacity = page.kind === 'cover' ? 1 : 4;
  const before = page.mediaIds.filter((id) => valid.has(id)).slice(0, Math.min(slot, capacity - 1));
  const mediaIds = Array.from(new Set([...before, ...ids.filter((id) => valid.has(id)), ...page.mediaIds.filter((id) => valid.has(id))])).slice(0, capacity);
  const layout = mediaIds.length > 1 ? 'collage' : page.layout === 'minimal' || page.layout === 'collage' ? 'full-photo' : page.layout;
  return { ...book, pages: book.pages.map((item, index) => index === pageIndex ? { ...item, kind: item.kind === 'closing' ? 'gallery' : item.kind, mediaIds, layout } : item) };
}

// Use measurable image properties; this does not claim to recognise people or places.
export function selectCoverPhoto(media: BookMedia[], variation = 0): BookMedia | undefined {
  const photos = media.filter((item) => item.kind === 'photo');
  const ranked = [...photos].sort((a, b) => {
    const score = (item: BookMedia) => {
      const pixels = (item.width || 1600) * (item.height || 1600);
      const ratio = (item.width || 1) / (item.height || 1);
      return Math.min(pixels, 12_000_000) / (1 + Math.abs(ratio - .8));
    };
    return score(b) - score(a);
  });
  return ranked.length ? ranked[((variation % ranked.length) + ranked.length) % ranked.length] : undefined;
}

export function refineBookLayout(book: GeneratedBook): GeneratedBook {
  const seen = new Set<string>();
  const canonical = new Map<string, string>();
  const media = book.media.filter((item) => {
    const key = item.fingerprint || item.id;
    if (seen.has(key)) { canonical.set(item.id, book.media.find((candidate) => (candidate.fingerprint || candidate.id) === key)!.id); return false; }
    seen.add(key); return true;
  });
  const photos = media.filter((item) => item.kind === 'photo');
  const photoIds = new Set(photos.map((item) => item.id));
  const interactiveIds = media.filter((item) => item.kind !== 'photo').map((item) => item.id);
  const available = [...photos];
  const eligible = book.pages.filter((page) => page.kind !== 'cover' && page.kind !== 'interactive' && page.kind !== 'closing');
  // Place all supplied photos before repeating any. Never leave a collage of empty slots.
  const cover = selectCoverPhoto(media);
  let next = 0;
  const usedBodies = new Set<string>();
  const pages = book.pages.map((page) => {
    if (page.kind === 'cover') return { ...page, mediaIds: cover ? [cover.id] : [], layout: 'full-photo' as const };
    if (page.kind === 'interactive') return { ...page, mediaIds: interactiveIds, layout: 'minimal' as const };
    if (page.kind === 'closing') return { ...page, mediaIds: [], layout: 'minimal' as const };
    const remainingSlots = eligible.length - next++;
    const count = available.length ? Math.min(3, Math.ceil(available.length / remainingSlots)) : 0;
    const selected = available.splice(0, count);
    const ids = selected.map((item) => canonical.get(item.id) || item.id).filter((id) => photoIds.has(id));
    let layout: typeof page.layout = 'minimal';
    if (ids.length > 1) layout = 'collage';
    else if (selected[0]) layout = (selected[0].width || 1) > (selected[0].height || 1) * 1.2 ? 'editorial' : page.body.length > 280 ? 'split' : 'full-photo';
    const repeated = usedBodies.has(page.body.trim());
    usedBodies.add(page.body.trim());
    return { ...page, body: repeated ? '' : page.body, quote: repeated ? undefined : page.quote, mediaIds: ids, layout };
  });
  const lowResolution = photos.filter((item) => item.width && item.height && Math.max(item.width, item.height) < 1800).length;
  const en = book.locale === 'en';
  return { ...book, media, pages, coverStyle: book.coverStyle || (cover ? 'window' : 'minimal'), qualityNotes: [
    ...(lowResolution ? [en ? `${lowResolution} photo(s) may lack detail at full-page print size. Use a smaller layout or a higher-resolution image.` : `${lowResolution} photo(s) risquent de manquer de détails en pleine page. Préférez un petit format ou une image plus définie.`] : []),
    ...(media.length < book.media.length ? [en ? 'Identical files were grouped for the initial layout.' : 'Les fichiers identiques ont été regroupés pour la composition initiale.'] : []),
  ] };
}
