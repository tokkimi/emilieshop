import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadMemoryLink } from '../../../lib/memory-link';
import '../memory-link.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Memory Link — Mémoire Maison', robots: { index: false, follow: false } };

export default async function MemoryLinkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadMemoryLink(slug);
  if (!data) notFound();
  const { book, media } = data;
  const en = book?.locale === 'en';
  const known = new Map(media.map((item) => [item.id, item]));
  const url = (id: string) => `/m/${slug}/media/${id}`;
  const photoIds = (ids: string[]) => ids.filter((id) => known.get(id)?.kind === 'photo');
  const pages = (book?.pages || []).filter((page) => page.kind !== 'cover' && page.kind !== 'interactive');
  const cover = book?.pages.find((page) => page.kind === 'cover');
  const heroPhoto = photoIds(cover?.mediaIds || [])[0] || media.find((item) => item.kind === 'photo')?.id;
  const used = new Set((book?.pages || []).flatMap((page) => page.mediaIds));
  const otherPhotos = media.filter((item) => item.kind === 'photo' && !used.has(item.id));
  const living = media.filter((item) => item.kind !== 'photo');
  const title = cover?.title || book?.title || 'Mémoire Maison';

  return (
    <main className="ml">
      <header className="ml-hero">
        {heroPhoto ? <img className="ml-hero-img" src={url(heroPhoto)} alt="" /> : null}
        <div className="ml-hero-text">
          <small>MÉMOIRE MAISON</small>
          <h1>{title}</h1>
          {book?.subtitle ? <p>{book.subtitle}</p> : null}
          {book?.address ? <p className="ml-address">{book.address}</p> : null}
        </div>
      </header>

      {living.length ? (
        <section className="ml-section ml-living">
          <h2>{en ? 'Films and voices' : 'Films et voix'}</h2>
          <div className="ml-living-grid">
            {living.map((item) => item.kind === 'video'
              ? <video key={item.id} src={url(item.id)} controls playsInline preload="metadata" />
              : <figure key={item.id}><figcaption>{item.filename}</figcaption><audio src={url(item.id)} controls preload="metadata" /></figure>)}
          </div>
        </section>
      ) : null}

      {pages.map((page) => {
        const ids = photoIds(page.mediaIds);
        return (
          <section className="ml-section ml-chapter" key={page.id}>
            {ids.length ? <div className={`ml-photos ml-photos-${Math.min(ids.length, 4)}`}>{ids.slice(0, 4).map((id) => <img key={id} src={url(id)} alt="" loading="lazy" />)}</div> : null}
            <div className="ml-copy">
              {page.eyebrow ? <small>{page.eyebrow}</small> : null}
              <h2>{page.title}</h2>
              {page.body ? <p>{page.body}</p> : null}
              {page.quote ? <blockquote>{page.quote}</blockquote> : null}
            </div>
          </section>
        );
      })}

      {otherPhotos.length ? (
        <section className="ml-section">
          <h2>{en ? 'More photos' : 'Toutes les photos'}</h2>
          <div className="ml-gallery">{otherPhotos.map((item) => <img key={item.id} src={url(item.id)} alt="" loading="lazy" />)}</div>
        </section>
      ) : null}

      <footer className="ml-footer">Mémoire Maison</footer>
    </main>
  );
}
