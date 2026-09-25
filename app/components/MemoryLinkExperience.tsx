'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from './SafeLink';
import { SiteHeader } from './SiteHeader';
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
  return fallbackBook({ locale, title: locale === 'en' ? 'The Maple House' : 'La maison des Érables', subtitle: '2008 — 2026', address: 'Québec', collection: locale === 'en' ? 'Keepsake' : 'Souvenir', coverColor: 'forest', answers: {}, media: [] }, `memory-${locale}`);
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

  const photos = useMemo(() => book.media.filter((item) => item.kind === 'photo' && item.previewUrl), [book.media]);
  const videos = useMemo(() => book.media.filter((item) => item.kind === 'video' && item.previewUrl), [book.media]);
  const audios = useMemo(() => book.media.filter((item) => item.kind === 'audio' && item.previewUrl), [book.media]);
  const storyPages = book.pages.filter((page) => page.kind !== 'cover' && page.body).slice(0, 3);
  const previewPath = en ? '/en/preview' : '/apercu';

  return <>
    <SiteHeader locale={locale} compact />
    <main className={`memory-page ${loaded ? 'is-loaded' : ''}`}>
      <section className="memory-cover memory-cover-live" style={photos[0]?.previewUrl ? { backgroundImage: `linear-gradient(120deg,rgba(24,42,34,.9),rgba(24,42,34,.25)),url(${photos[0].previewUrl})` } : undefined}>
        <p className="eyebrow">Memory Link · {en ? 'Private archive' : 'Archive privée'}</p>
        <h1>{book.title}</h1>
        <p>{[book.address, book.subtitle].filter(Boolean).join(' · ')}</p>
        <span className="memory-private-badge">● {en ? 'Private family space' : 'Espace familial privé'}</span>
        <span className="scroll-note">↓ {en ? 'Scroll through the story' : 'Faire défiler l’histoire'}</span>
      </section>

      <section className="memory-story">
        <div className="memory-intro"><span>01</span><div><p className="eyebrow">{storyPages[0]?.eyebrow || (en ? 'Our first chapter' : 'Notre premier chapitre')}</p><h2>{storyPages[0]?.title || (en ? 'It began with a front door.' : 'Tout a commencé par une porte.')}</h2></div><p>{storyPages[0]?.body}</p></div>
        <div className={`memory-gallery live-gallery count-${Math.min(photos.length, 6)}`}>{photos.slice(0, 6).map((photo, index) => <figure key={photo.id} className={index === 0 ? 'large' : ''}><img src={photo.previewUrl} alt={photo.name} loading="lazy" /><figcaption>{photo.name}</figcaption></figure>)}{!photos.length ? <div className="memory-empty-gallery"><span>＋</span><p>{en ? 'Your photographs will form a private family gallery here.' : 'Vos photographies formeront ici une galerie familiale privée.'}</p></div> : null}</div>
      </section>

      <section className="voice-memory voice-memory-live">
        <div className="voice-art"><span>“</span></div>
        <div><p className="eyebrow">{en ? 'Family voices' : 'Les voix de la famille'}</p><h2>{en ? 'Some memories deserve to be heard.' : 'Certains souvenirs méritent d’être entendus.'}</h2>{audios.length ? <div className="memory-audio-list">{audios.map((audio) => <article key={audio.id}><div><b>{audio.name}</b><small>{en ? 'Voice memory' : 'Souvenir vocal'}</small></div><audio src={audio.previewUrl} controls preload="metadata" /></article>)}</div> : <p className="memory-empty-copy">{en ? 'Add a voice recording in the studio and it will be playable here on phone, tablet and computer.' : 'Ajoutez un enregistrement vocal dans l’atelier : il sera lisible ici sur téléphone, tablette et ordinateur.'}</p>}</div>
      </section>

      <section className="film-section film-section-live">
        <div className="film-frame">{videos[0]?.previewUrl ? <video src={videos[0].previewUrl} controls preload="metadata" playsInline poster={photos[1]?.previewUrl} /> : <div className="film-empty"><span>▶</span><small>{en ? 'Your film will appear here' : 'Votre film apparaîtra ici'}</small></div>}</div>
        <div><p className="eyebrow">{en ? 'The family film' : 'Le film de famille'}</p><h2>{en ? 'A lifetime in a few minutes.' : 'Toute une époque en quelques minutes.'}</h2><p>{en ? 'Videos remain private and playable from the QR code printed in the book.' : 'Les vidéos restent privées et sont accessibles depuis le QR code imprimé dans le livre.'}</p>{videos.length > 1 ? <div className="memory-video-list">{videos.slice(1).map((video) => <video key={video.id} src={video.previewUrl} controls preload="metadata" playsInline />)}</div> : null}</div>
      </section>

      <section className="memory-end"><span>✦</span><h2>{en ? 'The story can keep growing.' : 'L’histoire peut continuer à grandir.'}</h2><p>{en ? 'This private archive brings together the book, photographs, voices and films. Its QR code stays the same as new memories are added.' : 'Cette archive privée réunit le livre, les photographies, les voix et les films. Son QR code reste identique lorsque de nouveaux souvenirs sont ajoutés.'}</p><Link className="button light" href={previewPath}>{en ? 'Return to my book' : 'Retourner à mon livre'}</Link></section>
    </main>
  </>;
}
