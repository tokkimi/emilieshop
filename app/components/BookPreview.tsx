'use client';

import '../book-editor.css';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from './SafeLink';
import { loadLocalMedia, saveLocalMedia } from '../../lib/client-media';
import { BOOK_STORAGE_KEY, bookForStorage, ensureCompleteBook, fallbackBook, type BookLocale, type BookMedia, type BookPage, type GeneratedBook } from '../../lib/book';
import { COVER_COLORS, PAGE_COLORS, PRINT_TRIM } from '../../lib/book-design';
import { CART_STORAGE_KEY, calculateCatalogSubtotal, formatCad } from '../../lib/catalog';
import { BookPageView } from './BookPageView';

type Tab = 'photos' | 'layouts' | 'colors' | 'link';
const LAYOUTS: { id: BookPage['layout']; fr: string; en: string }[] = [
  { id: 'full-photo', fr: 'Grande photo', en: 'Large photo' },
  { id: 'editorial', fr: 'Texte puis photo', en: 'Text then photo' },
  { id: 'split', fr: 'Photo et citation', en: 'Photo and quote' },
  { id: 'collage', fr: 'Collage', en: 'Collage' },
  { id: 'minimal', fr: 'Texte seul', en: 'Text only' },
];

function initialBook(locale: BookLocale) {
  return fallbackBook({ locale, title: locale === 'en' ? 'Our Home' : 'Notre Maison', subtitle: '2008 — 2026', address: '', collection: locale === 'en' ? 'Essential' : 'Essentiel', coverColor: 'white', answers: {}, media: [] }, `preview-${locale}`);
}

async function hydrateMedia(book: GeneratedBook) {
  const media = await Promise.all(book.media.map(async (item) => {
    if (item.previewUrl || !item.storageKey) return item;
    try { return { ...item, previewUrl: await loadLocalMedia(item.storageKey) }; } catch { return item; }
  }));
  return { ...book, media };
}

function readCart(): { projectId?: string; planId?: string; addOnIds?: string[] } {
  try { return JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '{}'); } catch { return {}; }
}

export function BookPreview({ locale = 'fr' }: { locale?: BookLocale }) {
  const en = locale === 'en';
  const tr = (fr: string, enText: string) => (en ? enText : fr);
  const [book, setBook] = useState<GeneratedBook>(() => initialBook(locale));
  const [restored, setRestored] = useState(false);
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState<Tab>('photos');
  const [slot, setSlot] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [uploading, setUploading] = useState(0);
  const [memorySlug, setMemorySlug] = useState('');
  const [origin, setOrigin] = useState('https://memoiremaison.com');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvalError, setApprovalError] = useState('');
  const [price, setPrice] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const profile = en ? '/en/profile' : '/profil';
  const studio = en ? '/en/studio' : '/atelier';

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOrigin(window.location.origin);
      const cart = readCart();
      if (cart.planId) setPrice(calculateCatalogSubtotal(cart.planId, cart.addOnIds || []));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      const projectId = new URL(window.location.href).searchParams.get('project');
      if (projectId) {
        const response = await fetch(`/api/book-generations?projectId=${encodeURIComponent(projectId)}`);
        if (response.ok) {
          const result = (await response.json()) as { generation: { result: GeneratedBook } };
          const restoredBook = await hydrateMedia(ensureCompleteBook(result.generation.result));
          if (!cancelled) { setBook(restoredBook); setRestored(true); }
          return;
        }
      }
      try {
        const stored = sessionStorage.getItem(BOOK_STORAGE_KEY) || localStorage.getItem(BOOK_STORAGE_KEY);
        if (stored) {
          const localBook = JSON.parse(stored) as GeneratedBook;
          if (projectId && localBook.projectId !== projectId) { if (!cancelled) setRestored(true); return; }
          const restoredBook = await hydrateMedia(ensureCompleteBook(localBook));
          if (!cancelled) { setBook(restoredBook); setRestored(true); }
          return;
        }
      } catch { /* start from the sample */ }
      if (!cancelled) setRestored(true);
    };
    void restore();
    return () => { cancelled = true; };
  }, []);

  // Lien Memory Link réel (adresse secrète) dès que le projet est enregistré.
  useEffect(() => {
    if (!book.projectId || memorySlug) return;
    let cancelled = false;
    void fetch('/api/memory-links', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: book.projectId }) })
      .then((response) => (response.ok ? (response.json() as Promise<{ slug?: string }>) : null))
      .then((result: { slug?: string } | null) => { if (!cancelled && result?.slug) setMemorySlug(result.slug); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [book.projectId, memorySlug]);

  useEffect(() => {
    if (!restored) return;
    const savingTimer = window.setTimeout(() => setSaveState('saving'), 0);
    const timer = window.setTimeout(async () => {
      const persistentBook = bookForStorage({ ...book, updatedAt: new Date().toISOString() });
      sessionStorage.setItem(BOOK_STORAGE_KEY, JSON.stringify(persistentBook));
      try { localStorage.setItem(BOOK_STORAGE_KEY, JSON.stringify(persistentBook)); } catch { /* ignore quota */ }
      if (book.projectId) {
        await fetch(`/api/book-generations/${encodeURIComponent(book.id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ book: persistentBook, version: book.version, status: book.status === 'approved' ? 'ready' : book.status }) }).catch(() => undefined);
      }
      setSaveState('saved');
    }, 700);
    return () => { window.clearTimeout(savingTimer); window.clearTimeout(timer); };
  }, [book, restored]);

  const mediaById = useMemo(() => new Map(book.media.map((item) => [item.id, item])), [book.media]);
  const photoUrl = (id: string) => { const item = mediaById.get(id); return item?.kind === 'photo' ? item.previewUrl : undefined; };
  const photos = book.media.filter((item) => item.kind === 'photo');
  const living = book.media.filter((item) => item.kind !== 'photo');
  const usedIds = useMemo(() => new Set(book.pages.flatMap((page) => page.mediaIds)), [book.pages]);
  const page = book.pages[active];
  const memoryUrl = memorySlug ? `${origin}/m/${memorySlug}` : '';

  const edit = (updater: (current: GeneratedBook) => GeneratedBook) => setBook((current) => ({ ...updater(current), status: 'ready', version: current.version + 1 }));
  const updatePage = (index: number, changes: Partial<BookPage>) => edit((current) => ({ ...current, pages: current.pages.map((item, i) => (i === index ? { ...item, ...changes } : item)) }));
  const updateBook = (changes: Partial<GeneratedBook>) => edit((current) => ({ ...current, ...changes }));

  const placePhoto = (mediaId: string) => {
    if (!page) return;
    const target = slot ?? page.mediaIds.length;
    const ids = [...page.mediaIds.filter((id) => mediaById.get(id)?.kind === 'photo')];
    if (target < ids.length) ids[target] = mediaId; else ids.push(mediaId);
    updatePage(active, { mediaIds: Array.from(new Set(ids)).slice(0, 4) });
    setSlot(null);
  };
  const removePhoto = (mediaId: string) => page && updatePage(active, { mediaIds: page.mediaIds.filter((id) => id !== mediaId) });

  const movePage = (direction: -1 | 1) => {
    const target = active + direction;
    if (active < 1 || target < 1 || target >= book.pages.length) return;
    edit((current) => { const pages = [...current.pages]; [pages[active], pages[target]] = [pages[target], pages[active]]; return { ...current, pages }; });
    setActive(target);
  };

  const addFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    setUploading((value) => value + files.length);
    const additions: BookMedia[] = [];
    for (const file of files) {
      const kind = file.type.startsWith('video/') ? 'video' as const : file.type.startsWith('audio/') ? 'audio' as const : 'photo' as const;
      let item: BookMedia | null = null;
      if (book.projectId) {
        const form = new FormData(); form.set('projectId', book.projectId); form.set('file', file);
        const response = await fetch('/api/uploads', { method: 'POST', body: form }).catch(() => null);
        if (response?.ok) { const result = (await response.json()) as { id: string }; item = { id: result.id, name: file.name, kind, previewUrl: `/api/media/${result.id}` }; }
      }
      if (!item) { const id = crypto.randomUUID(); await saveLocalMedia(id, file); item = { id, name: file.name, kind, previewUrl: URL.createObjectURL(file), storageKey: id }; }
      additions.push(item);
      setUploading((value) => Math.max(0, value - 1));
    }
    edit((current) => ({ ...current, media: [...current.media, ...additions] }));
    const firstPhoto = additions.find((item) => item.kind === 'photo');
    if (firstPhoto && slot !== null) placePhoto(firstPhoto.id);
  };

  const openCheckout = () => { setApprovalError(''); setConfirmed(false); setCheckoutOpen(true); };
  const approveAndPay = async () => {
    if (!book.projectId) { setApprovalError(tr('Ce livre n’est pas encore enregistré dans un compte. Revenez à l’atelier.', 'This book is not saved to an account yet. Return to the studio.')); return; }
    setApproving(true); setApprovalError('');
    try {
      const stored = bookForStorage(book);
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(stored)));
      const versionHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
      const saved = await fetch(`/api/book-generations/${encodeURIComponent(book.id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ book: stored, version: book.version, status: 'ready' }) });
      if (!saved.ok) throw new Error('save');
      const response = await fetch('/api/approvals', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: book.projectId, versionHash, version: book.version }) });
      if (!response.ok) throw new Error('approval');
      const cart = readCart();
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ planId: 'essential', addOnIds: [], ...cart, projectId: book.projectId, updatedAt: new Date().toISOString() }));
      window.location.assign(`${en ? '/en/order' : '/commande'}?project=${encodeURIComponent(book.projectId)}`);
    } catch {
      setApprovalError(tr('La validation n’a pas pu être enregistrée. Réessayez.', 'Approval could not be saved. Please try again.'));
      setApproving(false);
    }
  };

  const choosePhotoSlot = (index: number, slotIndex: number) => { setActive(index); setSlot(slotIndex); setTab('photos'); };

  return (
    <main className="bk-shell">
      <header className="bk-top">
        <Link className="bk-logo" href={profile}><img src="/memoire-maison-logo.png" alt="Mémoire Maison" /></Link>
        <span className={`bk-save ${saveState}`}>{saveState === 'saved' ? tr('✓ Enregistré', '✓ Saved') : tr('Enregistrement…', 'Saving…')}</span>
        <div className="bk-top-actions">
          <button type="button" className="bk-ghost" onClick={() => window.print()}>{tr('Aperçu PDF', 'PDF proof')}</button>
          <button type="button" className="bk-pay" onClick={openCheckout} disabled={!restored}>{tr('Payer et imprimer', 'Pay and print')}{price ? ` · ${formatCad(price, locale)}` : ''} →</button>
        </div>
      </header>

      <div className="bk-body">
        <aside className="bk-side">
          <nav className="bk-tabs">
            {(['photos', 'layouts', 'colors', 'link'] as Tab[]).map((id) => (
              <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
                {id === 'photos' ? tr('Photos', 'Photos') : id === 'layouts' ? tr('Mise en page', 'Layout') : id === 'colors' ? tr('Couleurs', 'Colours') : 'Memory Link'}
              </button>
            ))}
          </nav>
          <div className="bk-panel">
            {tab === 'photos' ? (
              <>
                <p className="bk-hint">{slot !== null ? tr('Choisissez la photo à placer sur la page.', 'Pick the photo to place on the page.') : tr('Cliquez une photo pour l’ajouter à la page affichée.', 'Click a photo to add it to the page shown.')}</p>
                <button type="button" className="bk-upload" onClick={() => fileInput.current?.click()}>{uploading ? tr(`Envoi… (${uploading})`, `Uploading… (${uploading})`) : tr('+ Ajouter des photos, vidéos ou voix', '+ Add photos, videos or voices')}</button>
                <input ref={fileInput} type="file" hidden multiple accept="image/*,video/*,audio/*" onChange={addFiles} />
                <div className="bk-tray">
                  {photos.map((item) => (
                    <button key={item.id} type="button" className={`bk-tray-item ${page?.mediaIds.includes(item.id) ? 'on-page' : ''}`} onClick={() => placePhoto(item.id)}>
                      {item.previewUrl ? <img src={item.previewUrl} alt="" /> : <span>▧</span>}
                      {usedIds.has(item.id) ? <i>✓</i> : null}
                    </button>
                  ))}
                </div>
                {page && page.mediaIds.some((id) => mediaById.get(id)?.kind === 'photo') ? (
                  <div className="bk-onpage">
                    <p className="bk-label">{tr('Sur cette page', 'On this page')}</p>
                    {page.mediaIds.filter((id) => mediaById.get(id)?.kind === 'photo').map((id) => (
                      <span key={id}><img src={photoUrl(id)} alt="" /><button type="button" onClick={() => removePhoto(id)} aria-label={tr('Retirer', 'Remove')}>×</button></span>
                    ))}
                  </div>
                ) : null}
                {living.length ? <p className="bk-hint">{tr(`${living.length} vidéo(s) ou voix : elles sont dans le Memory Link.`, `${living.length} video(s) or voice(s): they live in the Memory Link.`)}</p> : null}
              </>
            ) : null}
            {tab === 'layouts' && page ? (
              page.kind === 'cover' || page.kind === 'interactive' ? <p className="bk-hint">{tr('Cette page a une mise en page fixe.', 'This page has a fixed layout.')}</p> : (
                <>
                  <div className="bk-layouts">
                    {LAYOUTS.map((layout) => (
                      <button key={layout.id} type="button" className={page.layout === layout.id ? 'active' : ''} onClick={() => updatePage(active, { layout: layout.id })}>
                        <i className={`bk-mini bk-mini-${layout.id}`} />
                        <span>{en ? layout.en : layout.fr}</span>
                      </button>
                    ))}
                  </div>
                  <div className="bk-move">
                    <button type="button" onClick={() => movePage(-1)} disabled={active <= 1}>← {tr('Avancer la page', 'Move earlier')}</button>
                    <button type="button" onClick={() => movePage(1)} disabled={active >= book.pages.length - 1}>{tr('Reculer la page', 'Move later')} →</button>
                  </div>
                </>
              )
            ) : null}
            {tab === 'colors' ? (
              <>
                <p className="bk-label">{tr('Couverture', 'Cover')}</p>
                <div className="bk-swatches">{COVER_COLORS.map((color) => <button key={color.id} type="button" title={color.label[locale]} className={(book.coverColor || 'white') === color.id ? 'active' : ''} style={{ background: color.bg }} onClick={() => updateBook({ coverColor: color.id })} />)}</div>
                <p className="bk-label">{tr('Fond des pages', 'Page background')}</p>
                <div className="bk-swatches">{PAGE_COLORS.map((color) => <button key={color.id} type="button" title={color.label[locale]} className={(book.pageColor || 'white') === color.id ? 'active' : ''} style={{ background: color.bg }} onClick={() => updateBook({ pageColor: color.id })} />)}</div>
                <p className="bk-hint">{tr(`Format imprimé : ${PRINT_TRIM.label}, couverture rigide.`, `Print size: 8.5 × 11 in, hardcover.`)}</p>
              </>
            ) : null}
            {tab === 'link' ? (
              <>
                <p className="bk-hint">{tr('Une page web privée avec toutes vos photos, vidéos et voix. Le QR code imprimé dans le livre l’ouvre, depuis n’importe où.', 'A private web page with all your photos, videos and voices. The QR code printed in the book opens it from anywhere.')}</p>
                {memoryUrl ? (
                  <>
                    <a className="bk-upload" href={memoryUrl} target="_blank" rel="noreferrer">{tr('Ouvrir le Memory Link ↗', 'Open the Memory Link ↗')}</a>
                    <button type="button" className="bk-ghost wide" onClick={() => { void navigator.clipboard?.writeText(memoryUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }}>{copied ? tr('Lien copié ✓', 'Link copied ✓') : tr('Copier le lien', 'Copy link')}</button>
                  </>
                ) : <p className="bk-hint">{tr('Le lien sera créé dès que le livre est enregistré dans votre compte.', 'The link is created once the book is saved to your account.')}</p>}
              </>
            ) : null}
          </div>
          <Link className="bk-back" href={studio}>← {tr('Revenir à mes réponses', 'Back to my answers')}</Link>
        </aside>

        <section className="bk-stage" onClick={() => setSlot(null)}>
          <div className="bk-sheet">
            {page ? <BookPageView page={page} book={book} index={active} photoUrl={photoUrl} qrUrl={memoryUrl || `${origin}/memory/demo`} editable en={en} onChange={(changes) => updatePage(active, changes)} onBookChange={updateBook} onPhotoSlot={(slotIndex) => choosePhotoSlot(active, slotIndex)} /> : null}
          </div>
          <div className="bk-pager">
            <button type="button" onClick={(event) => { event.stopPropagation(); setActive((value) => Math.max(0, value - 1)); }} disabled={active === 0}>←</button>
            <span>{active === 0 ? tr('Couverture', 'Cover') : tr(`Page ${active} sur ${book.pages.length - 1}`, `Page ${active} of ${book.pages.length - 1}`)}</span>
            <button type="button" onClick={(event) => { event.stopPropagation(); setActive((value) => Math.min(book.pages.length - 1, value + 1)); }} disabled={active >= book.pages.length - 1}>→</button>
          </div>
          <p className="bk-tip">{tr('Cliquez sur un texte pour le modifier, sur un cadre photo pour changer la photo.', 'Click any text to edit it, and any photo frame to change the photo.')}</p>
        </section>
      </div>

      <footer className="bk-strip">
        {book.pages.map((item, index) => (
          <button key={item.id} type="button" className={`bk-thumb ${index === active ? 'active' : ''}`} onClick={() => setActive(index)} aria-label={index === 0 ? tr('Couverture', 'Cover') : `Page ${index}`}>
            <div className="bk-thumb-page"><BookPageView page={item} book={book} index={index} photoUrl={photoUrl} /></div>
            <span>{index === 0 ? tr('Couv.', 'Cover') : index}</span>
          </button>
        ))}
      </footer>

      <section className="bk-print" aria-hidden="true">
        {book.pages.map((item, index) => <div className="bk-print-page" key={item.id}><BookPageView page={item} book={book} index={index} photoUrl={photoUrl} qrUrl={memoryUrl || undefined} /></div>)}
      </section>

      {checkoutOpen ? (
        <div className="bk-modal" role="dialog" aria-modal="true">
          <div className="bk-modal-card">
            <button type="button" className="bk-close" onClick={() => setCheckoutOpen(false)} aria-label={tr('Fermer', 'Close')}>×</button>
            <h2>{tr('Prêt à imprimer ?', 'Ready to print?')}</h2>
            <p>{tr(`Votre livre sera imprimé tel qu’affiché (${book.pages.length - 1} pages, ${PRINT_TRIM.label}, couverture rigide).`, `Your book will be printed exactly as shown (${book.pages.length - 1} pages, 8.5 × 11 in, hardcover).`)}</p>
            <label className="bk-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>{tr('J’ai relu toutes les pages et je valide cette version pour l’impression.', 'I reviewed every page and approve this version for printing.')}</span></label>
            {approvalError ? <p className="bk-error" role="alert">{approvalError}</p> : null}
            <button type="button" className="bk-pay wide" disabled={!confirmed || approving} onClick={approveAndPay}>{approving ? tr('Un instant…', 'One moment…') : tr('Continuer vers le paiement →', 'Continue to payment →')}</button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
