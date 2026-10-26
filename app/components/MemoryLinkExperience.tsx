'use client';

import { useEffect, useState } from 'react';
import { MemoryBookReader } from './MemoryBookReader';
import { loadLocalMedia } from '../../lib/client-media';
import { BOOK_STORAGE_KEY, ensureCompleteBook, fallbackBook, type BookLocale, type GeneratedBook } from '../../lib/book';

async function restoreMedia(book: GeneratedBook) {
  const media = await Promise.all(book.media.map(async (item) => {
    if (item.previewUrl || !item.storageKey) return item;
    try { return { ...item, previewUrl: await loadLocalMedia(item.storageKey) }; } catch { return item; }
  }));
  return { ...book, media };
}

function sampleBook(locale: BookLocale) {
  return fallbackBook({ locale, title: locale === 'en' ? 'The Maple House' : 'La maison des Érables', subtitle: '2008 — 2026', address: 'Québec', collection: locale === 'en' ? 'Keepsake' : 'Souvenir', coverColor: 'midnight', answers: {}, media: [] }, `memory-${locale}`);
}

export function MemoryLinkExperience({ locale = 'fr', initialBook }: { locale?: BookLocale; initialBook?: GeneratedBook }) {
  const en = locale === 'en';
  const [book, setBook] = useState<GeneratedBook>(() => initialBook ? ensureCompleteBook(initialBook) : sampleBook(locale));
  const [loaded, setLoaded] = useState(Boolean(initialBook));

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      if (initialBook) { if (!cancelled) setLoaded(true); return; }
      try {
        const stored = sessionStorage.getItem(BOOK_STORAGE_KEY) || localStorage.getItem(BOOK_STORAGE_KEY);
        if (stored) {
          const next = await restoreMedia(ensureCompleteBook(JSON.parse(stored) as GeneratedBook));
          if (!cancelled) setBook(next);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    void restore();
    return () => { cancelled = true; };
  }, [initialBook]);

  return <MemoryBookReader book={book} en={en}/>;
}
