'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Link from './SafeLink';
import { loadLocalMedia, saveLocalMedia } from '../../lib/client-media';
import {
  BOOK_STORAGE_KEY,
  bookForStorage,
  ensureCompleteBook,
  fallbackBook,
  type BookLocale,
  type BookMedia,
  type BookPage,
  type GeneratedBook,
} from '../../lib/book';

function initialBook(locale: BookLocale) {
  return fallbackBook({ locale, title: locale === 'en' ? 'Our Home' : 'Notre Maison', subtitle: '2008 — 2026', address: '', collection: locale === 'en' ? 'Essential' : 'Essentiel', coverColor: 'forest', answers: {}, media: [] }, `preview-${locale}`);
}

async function hydrateMedia(book: GeneratedBook) {
  const media = await Promise.all(book.media.map(async (item) => {
    if (item.previewUrl || !item.storageKey) return item;
    try { return { ...item, previewUrl: await loadLocalMedia(item.storageKey) }; } catch { return item; }
  }));
  return { ...book, media };
}

export function BookPreview({ locale = 'fr' }: { locale?: BookLocale }) {
  const en = locale === 'en';
  const [book, setBook] = useState<GeneratedBook>(() => initialBook(locale));
  const [activePage, setActivePage] = useState(0);
  const [compact, setCompact] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [approved, setApproved] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvalError, setApprovalError] = useState('');
  const [panel, setPanel] = useState<'edit' | 'media' | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [origin, setOrigin] = useState('https://emilieshop.vercel.app');
  const profile = en ? '/en/profile' : '/profil';
  const studio = en ? '/en/studio' : '/atelier';
  const memoryPath = en ? '/en/memory/demo' : '/memory/demo';

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 800px)');
    const sync = () => setCompact(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener('change', sync);
    const originTimer = window.setTimeout(() => setOrigin(window.location.origin), 0);
    return () => { window.clearTimeout(originTimer); mediaQuery.removeEventListener('change', sync); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      try {
        const stored = sessionStorage.getItem(BOOK_STORAGE_KEY) || localStorage.getItem(BOOK_STORAGE_KEY);
        if (stored) {
          const restored = await hydrateMedia(ensureCompleteBook(JSON.parse(stored) as GeneratedBook));
          if (!cancelled) setBook(restored);
          return;
        }
      } catch { /* The persisted server copy remains available below. */ }
      const projectId = new URL(window.location.href).searchParams.get('project');
      if (!projectId) return;
      const response = await fetch(`/api/book-generations?projectId=${encodeURIComponent(projectId)}`);
      if (response.ok) {
        const result = (await response.json()) as { generation: { result: GeneratedBook } };
        const restored = await hydrateMedia(ensureCompleteBook(result.generation.result));
        if (!cancelled) setBook(restored);
      }
    };
    void restore();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const savingTimer = window.setTimeout(() => setSaveState('saving'), 0);
    const timer = window.setTimeout(async () => {
      const next = { ...book, updatedAt: new Date().toISOString() };
      const persistentBook = bookForStorage(next);
      sessionStorage.setItem(BOOK_STORAGE_KEY, JSON.stringify(persistentBook));
      try { localStorage.setItem(BOOK_STORAGE_KEY, JSON.stringify(persistentBook)); } catch { /* IndexedDB still preserves media. */ }
      if (book.projectId) {
        await fetch(`/api/book-generations/${encodeURIComponent(book.id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ book: persistentBook, version: book.version, status: book.status }) });
      }
      setSaveState('saved');
    }, 700);
    return () => { window.clearTimeout(savingTimer); window.clearTimeout(timer); };
  }, [book]);

  const spread = Math.floor(activePage / 2);
  const spreads = useMemo(() => Array.from({ length: Math.ceil(book.pages.length / 2) }, (_, index) => book.pages.slice(index * 2, index * 2 + 2)), [book.pages]);
  const current = spreads[spread] || [];
  const selectedPage = book.pages[activePage];
  const memoryUrl = `${origin}${memoryPath}?book=${encodeURIComponent(book.id)}`;

  const updatePage = (changes: Partial<BookPage>) => setBook((currentBook) => ({ ...currentBook, version: currentBook.version + 1, pages: currentBook.pages.map((page, index) => index === activePage ? { ...page, ...changes } : page) }));
  const movePage = (direction: -1 | 1) => setBook((currentBook) => {
    const target = activePage + direction;
    if (target < 1 || target >= currentBook.pages.length) return currentBook;
    const pages = [...currentBook.pages];
    [pages[activePage], pages[target]] = [pages[target], pages[activePage]];
    window.setTimeout(() => setActivePage(target), 0);
    return { ...currentBook, version: currentBook.version + 1, pages };
  });

  const addMedia = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const targetPage = activePage;
    const additions = await Promise.all(files.map(async (file) => {
      const id = crypto.randomUUID();
      await saveLocalMedia(id, file);
      return { id, name: file.name, kind: file.type.startsWith('video/') ? 'video' as const : file.type.startsWith('audio/') ? 'audio' as const : 'photo' as const, previewUrl: URL.createObjectURL(file), storageKey: id };
    }));
    setBook((currentBook) => ({ ...currentBook, version: currentBook.version + 1, media: [...currentBook.media, ...additions], pages: currentBook.pages.map((page, index) => index === targetPage ? { ...page, mediaIds: [...page.mediaIds, ...additions.map((item) => item.id)].slice(0, 8) } : page) }));
    event.target.value = '';
  };

  const toggleMedia = (id: string) => updatePage({ mediaIds: selectedPage.mediaIds.includes(id) ? selectedPage.mediaIds.filter((item) => item !== id) : [...selectedPage.mediaIds, id].slice(0, 8) });
  const approve = async () => {
    if (approving || approved) return;
    setApproving(true);
    setApprovalError('');
    try {
      const payload = JSON.stringify(bookForStorage(book));
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
      const versionHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
      if (book.projectId) {
        const response = await fetch('/api/approvals', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: book.projectId, versionHash }) });
        if (!response.ok) throw new Error('approval');
      }
      setBook((value) => ({ ...value, status: 'approved' }));
      setApproved(true);
    } catch {
      setApprovalError(en ? 'Approval could not be secured. Nothing was sent to print; please try again.' : 'La validation n’a pas pu être sécurisée. Rien n’a été envoyé à l’impression; réessayez.');
    } finally {
      setApproving(false);
    }
  };
  const previous = () => setActivePage((page) => Math.max(0, page - (compact ? 1 : 2)));
  const next = () => setActivePage((page) => Math.min(book.pages.length - 1, page + (compact ? 1 : 2)));

  return <main className="preview-shell">
    <header className="preview-top"><Link className="brand" href={profile}><span className="brand-mark">M</span><span>Mémoire Maison</span></Link><div className="preview-progress"><span className="done">✓ {en ? 'Creation' : 'Création'}</span><i /><span className="active">2 {en ? 'Preview' : 'Aperçu'}</span><i /><span>3 {en ? 'Print' : 'Impression'}</span><i /><span>4 {en ? 'Delivery' : 'Livraison'}</span></div><span className={`save-indicator ${saveState}`}>{saveState === 'saved' ? `✓ ${en ? 'Saved' : 'Enregistré'}` : en ? 'Saving…' : 'Enregistrement…'}</span></header>

    <section className="preview-workspace">
      <aside className="preview-tools"><p className="eyebrow">{en ? 'Your digital proof' : 'Votre aperçu numérique'}</p><h1>{en ? 'Review and make it yours.' : 'Relisez et faites-le vôtre.'}</h1><p>{en ? 'Select a page, then edit its words, layout or memories. Nothing goes to print without your approval.' : 'Sélectionnez une page, puis modifiez ses mots, sa mise en page ou ses souvenirs. Rien ne part à l’impression sans votre accord.'}</p><div className="preview-checks"><span>✓ {en ? 'Every fact comes from your answers' : 'Chaque fait vient de vos réponses'}</span><span>✓ {en ? 'All text remains editable' : 'Tous les textes restent modifiables'}</span><span>✓ {en ? '25-page proof · 24-page interior' : 'Aperçu 25 pages · intérieur 24 pages'}</span><span>✓ {en ? 'Films and voices stay in Memory Link' : 'Films et voix restent dans Memory Link'}</span></div><button type="button" className={panel === 'edit' ? 'active' : ''} onClick={() => setPanel(panel === 'edit' ? null : 'edit')}>✎ {en ? 'Edit this page' : 'Modifier cette page'}</button><button type="button" className={panel === 'media' ? 'active' : ''} onClick={() => setPanel(panel === 'media' ? null : 'media')}>▧ {en ? 'Memories on this page' : 'Souvenirs de cette page'}</button><button type="button" onClick={() => window.print()}><span className="download-icon" aria-hidden="true" /> {en ? 'Export the complete proof' : 'Exporter l’aperçu complet'}</button><Link className="memory-preview-link" href={memoryUrl}>▶ {en ? 'Open the digital Memory Link' : 'Ouvrir le Memory Link numérique'}</Link><Link href={studio}>← {en ? 'Return to my answers' : 'Revenir à mes réponses'}</Link></aside>

      <div className="book-stage"><div className={`open-book color-${book.coverColor}`}>{[0, 1].map((side) => { const page = current[side]; const pageIndex = spread * 2 + side; return <article key={page?.id || side} tabIndex={page ? 0 : -1} className={`book-page page-${page?.kind || 'blank'} ${side === 0 ? 'left-page' : 'right-page'} ${activePage === pageIndex ? 'selected' : ''} layout-${page?.layout || 'minimal'}`} onClick={() => page && setActivePage(pageIndex)}>{page ? <PageContent page={page} book={book} en={en} memoryUrl={memoryUrl} /> : null}</article>; })}</div><p className="page-select-hint">{en ? 'Tap a page to edit it' : 'Touchez une page pour la modifier'}</p><div className="page-controls"><button type="button" onClick={previous} disabled={activePage === 0} aria-label={en ? 'Previous page' : 'Page précédente'}>←</button><span>{compact ? `${en ? 'Page' : 'Page'} ${activePage + 1} / ${book.pages.length}` : `${en ? 'Pages' : 'Pages'} ${spread * 2 + 1}—${Math.min(book.pages.length, spread * 2 + 2)} / ${book.pages.length}`}</span><button type="button" onClick={next} disabled={activePage >= book.pages.length - 1} aria-label={en ? 'Next page' : 'Page suivante'}>→</button></div><div className="thumbnail-strip">{book.pages.map((page, index) => <button type="button" key={page.id} className={activePage === index ? 'active' : ''} onClick={() => setActivePage(index)} aria-label={`${en ? 'Page' : 'Page'} ${index + 1}`}><i className={`thumb-${page.kind}`} /><span>{index + 1}</span></button>)}</div></div>

      {panel && selectedPage && <aside className="page-editor"><header><div><small>{en ? 'Selected page' : 'Page sélectionnée'} {activePage + 1}</small><b>{selectedPage.title}</b></div><button type="button" onClick={() => setPanel(null)} aria-label={en ? 'Close' : 'Fermer'}>×</button></header>{panel === 'edit' ? <><label>{en ? 'Small heading' : 'Petit titre'}<input value={selectedPage.eyebrow || ''} onChange={(event) => updatePage({ eyebrow: event.target.value })} /></label><label>{en ? 'Page title' : 'Titre de la page'}<input value={selectedPage.title} onChange={(event) => updatePage({ title: event.target.value })} /></label><label>{en ? 'Story' : 'Récit'}<textarea value={selectedPage.body} onChange={(event) => updatePage({ body: event.target.value })} /></label><label>{en ? 'Quote (optional)' : 'Citation (facultative)'}<textarea value={selectedPage.quote || ''} onChange={(event) => updatePage({ quote: event.target.value })} /></label><fieldset><legend>{en ? 'Layout' : 'Mise en page'}</legend><div className="layout-choices">{(['editorial', 'full-photo', 'split', 'collage', 'minimal'] as const).map((layout) => <button type="button" key={layout} className={selectedPage.layout === layout ? 'active' : ''} onClick={() => updatePage({ layout })}>{layout === 'editorial' ? (en ? 'Editorial' : 'Éditoriale') : layout === 'full-photo' ? (en ? 'Full image' : 'Grande image') : layout === 'split' ? (en ? 'Split' : 'Partagée') : layout === 'collage' ? 'Collage' : (en ? 'Minimal' : 'Épurée')}</button>)}</div></fieldset><div className="page-order"><button type="button" onClick={() => movePage(-1)} disabled={activePage <= 1}>← {en ? 'Move before' : 'Déplacer avant'}</button><button type="button" onClick={() => movePage(1)} disabled={activePage >= book.pages.length - 1}>{en ? 'Move after' : 'Déplacer après'} →</button></div></> : <><label className="editor-upload"><input type="file" accept="image/*,video/*,audio/*" multiple onChange={addMedia} />＋ {en ? 'Add photos, films or voices' : 'Ajouter photos, films ou voix'}</label><p className="editor-media-note">{en ? 'Photos appear in print. Films and voices play in the private Memory Link.' : 'Les photos apparaissent dans le livre. Les films et les voix se lisent dans le Memory Link privé.'}</p><div className="editor-media-grid">{book.media.map((item) => <MediaTile key={item.id} item={item} selected={selectedPage.mediaIds.includes(item.id)} onToggle={() => toggleMedia(item.id)} en={en} />)}</div>{!book.media.length && <p>{en ? 'Add your first memory to this page.' : 'Ajoutez votre premier souvenir à cette page.'}</p>}</>}</aside>}
    </section>

    <footer className="approval-bar"><label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span><b>{en ? 'I reviewed every page and approve this exact version for printing.' : 'J’ai relu toutes les pages et j’approuve cette version exacte pour impression.'}</b><small>{en ? `Version ${book.version} · Changes stay available until approval.` : `Version ${book.version} · Les modifications restent possibles jusqu’à la validation.`}</small>{approvalError ? <small className="approval-error" role="alert">{approvalError}</small> : null}</span></label><button type="button" className="button" disabled={!confirmed || approved || approving} onClick={approve}>{approving ? (en ? 'Securing…' : 'Sécurisation…') : approved ? (en ? 'Approved ✓' : 'Aperçu approuvé ✓') : (en ? 'Approve for printing →' : 'Valider pour impression →')}</button></footer>

    <section className="print-book" aria-hidden="true">{book.pages.map((page, index) => <article className={`print-page book-page page-${page.kind} layout-${page.layout} color-${book.coverColor}`} key={page.id}><PageContent page={page} book={book} en={en} memoryUrl={memoryUrl} /><span className="print-proof-note">{index === 0 ? (en ? 'DIGITAL PROOF · COVER' : 'APERÇU NUMÉRIQUE · COUVERTURE') : `${en ? 'INTERIOR' : 'INTÉRIEUR'} · ${index}/24`}</span></article>)}</section>
    {approved && <div className="approval-success"><span>✓</span><h2>{en ? 'Preview approved.' : 'Aperçu approuvé.'}</h2><p>{en ? 'This exact version was timestamped. You can now follow production from your account.' : 'Cette version exacte a été horodatée. Vous pouvez maintenant suivre la production depuis votre compte.'}</p><Link className="button" href={profile}>{en ? 'Track my order →' : 'Suivre ma commande →'}</Link></div>}
  </main>;
}

function MediaTile({ item, selected, onToggle, en }: { item: BookMedia; selected: boolean; onToggle: () => void; en: boolean }) {
  return <article className={`editor-media-card ${selected ? 'active' : ''}`}><div className="editor-media-preview">{item.kind === 'photo' && item.previewUrl ? <img src={item.previewUrl} alt={item.name} /> : null}{item.kind === 'video' && item.previewUrl ? <video src={item.previewUrl} controls preload="metadata" playsInline /> : null}{item.kind === 'audio' && item.previewUrl ? <audio src={item.previewUrl} controls preload="metadata" /> : null}{!item.previewUrl ? <span className="missing-media">{item.kind === 'photo' ? '▧' : item.kind === 'video' ? '▶' : '♪'}</span> : null}</div><small>{item.name}</small><button type="button" onClick={onToggle}>{selected ? `✓ ${en ? 'Added' : 'Ajouté'}` : `＋ ${en ? 'Add' : 'Ajouter'}`}</button></article>;
}

function PageContent({ page, book, en, memoryUrl }: { page: BookPage; book: GeneratedBook; en: boolean; memoryUrl: string }) {
  const media = page.mediaIds.map((id) => book.media.find((item) => item.id === id)).filter((item): item is BookMedia => Boolean(item));
  const photos = media.filter((item) => item.kind === 'photo' && item.previewUrl);
  const interactive = media.filter((item) => item.kind !== 'photo');
  if (page.kind === 'cover') return <><small>{page.eyebrow || 'MÉMOIRE MAISON'}</small><h2>{page.title}</h2>{photos[0]?.previewUrl ? <img className="page-main-image" src={photos[0].previewUrl} alt={photos[0].name} /> : <div className="cover-photo"><span className="mini-house" /></div>}<p>{page.body}</p><small>{book.subtitle}</small></>;
  return <><p className="page-number">{book.pages.findIndex((item) => item.id === page.id) + 1}</p>{page.eyebrow ? <p className="eyebrow">{page.eyebrow}</p> : null}<h3>{page.title}</h3>{photos.length ? <div className={`page-media-collage media-count-${Math.min(photos.length, 4)}`}>{photos.slice(0, 4).map((photo) => <img key={photo.id} src={photo.previewUrl} alt={photo.name} />)}</div> : null}<p>{page.body}</p>{page.quote ? <blockquote>{page.quote}</blockquote> : null}{page.kind === 'interactive' ? <div className="voice-qr"><QRCodeSVG value={memoryUrl} size={64} level="M" marginSize={1} /><span><b>{interactive.length ? `${interactive.length} ${en ? 'living memories' : 'souvenirs vivants'}` : (en ? 'Private family link' : 'Lien privé de la famille')}</b><small>{en ? 'Scan to watch and listen' : 'Scanner pour voir et écouter'}</small></span></div> : null}</>;
}
