'use client';

import { createElement, useEffect, useRef, type KeyboardEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { BookPage, GeneratedBook } from '../../lib/book';
import { coverColor, pageColor } from '../../lib/book-design';

type Tag = 'h1' | 'h2' | 'h3' | 'p' | 'small' | 'blockquote' | 'span';

function EditableText({ as, value, placeholder, editable, className, onCommit, multiline = true }: { as: Tag; value: string; placeholder: string; editable: boolean; className?: string; onCommit?: (value: string) => void; multiline?: boolean }) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (node && document.activeElement !== node && node.innerText !== value) node.innerText = value;
  }, [value, editable]);
  if (!editable) return value ? createElement(as, { className }, value) : null;
  const Element = as as 'p';
  return (
    <Element
      ref={ref as React.RefObject<HTMLParagraphElement>}
      className={`${className || ''} bk-editable`}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event: KeyboardEvent<HTMLElement>) => { if (!multiline && event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }}
      onBlur={(event) => { const next = event.currentTarget.innerText.replace(/\n{3,}/g, '\n\n').trim(); if (next !== value) onCommit?.(next); }}
    />
  );
}

export type PageViewProps = {
  page: BookPage;
  book: GeneratedBook;
  index: number;
  photoUrl: (mediaId: string) => string | undefined;
  qrUrl?: string;
  editable?: boolean;
  en?: boolean;
  onChange?: (changes: Partial<BookPage>) => void;
  onBookChange?: (changes: Partial<GeneratedBook>) => void;
  onPhotoSlot?: (slot: number) => void;
};

function slotCount(page: BookPage) {
  if (page.kind === 'interactive' || page.kind === 'closing' || page.layout === 'minimal') return 0;
  if (page.layout === 'collage') return Math.max(2, Math.min(4, page.mediaIds.length || 4));
  return 1;
}

export function BookPageView({ page, book, index, photoUrl, qrUrl, editable = false, en = false, onChange, onBookChange, onPhotoSlot }: PageViewProps) {
  const isCover = page.kind === 'cover';
  const cover = coverColor(book.coverColor);
  const paper = pageColor(book.pageColor);
  const style = isCover
    ? ({ '--bk-bg': cover.bg, '--bk-ink': cover.ink, '--bk-soft': cover.ink } as React.CSSProperties)
    : ({ '--bk-bg': paper.bg, '--bk-ink': paper.ink, '--bk-soft': paper.soft } as React.CSSProperties);
  const slots = isCover ? 1 : slotCount(page);
  const photos = page.mediaIds.map((id) => ({ id, url: photoUrl(id) })).filter((item) => item.url);

  const photoArea = slots && (editable || photos.length) ? (
    <div className={`bk-photos bk-photos-${slots}`}>
      {Array.from({ length: slots }, (_, slot) => {
        const photo = photos[slot];
        if (!photo && !editable) return <div key={slot} className="bk-photo bk-photo-blank" />;
        return (
          <button key={slot} type="button" className={`bk-photo ${photo ? '' : 'bk-photo-empty'}`} disabled={!editable} onClick={(event) => { event.stopPropagation(); onPhotoSlot?.(slot); }} aria-label={en ? 'Choose a photo' : 'Choisir une photo'}>
            {photo ? <img src={photo.url} alt="" /> : <span>{en ? '+ Photo' : '+ Photo'}</span>}
          </button>
        );
      })}
    </div>
  ) : null;

  const text = (
    <div className="bk-text">
      <EditableText as="small" className="bk-eyebrow" value={page.eyebrow || ''} placeholder={en ? 'Small heading' : 'Petit titre'} editable={editable} multiline={false} onCommit={(eyebrow) => onChange?.({ eyebrow })} />
      <EditableText as="h3" className="bk-title" value={page.title} placeholder={en ? 'Title' : 'Titre'} editable={editable} multiline={false} onCommit={(title) => onChange?.({ title })} />
      <EditableText as="p" className="bk-copy" value={page.body} placeholder={en ? 'Your text' : 'Votre texte'} editable={editable} onCommit={(body) => onChange?.({ body })} />
      {page.quote || (editable && page.layout === 'split') ? <EditableText as="blockquote" className="bk-quote" value={page.quote || ''} placeholder={en ? 'Quote (optional)' : 'Citation (facultative)'} editable={editable} onCommit={(quote) => onChange?.({ quote })} /> : null}
    </div>
  );

  if (isCover) {
    return (
      <div className="bk-page bk-cover" style={style}>
        <small className="bk-brand">MÉMOIRE MAISON</small>
        {photoArea}
        <EditableText as="h2" className="bk-cover-title" value={page.title} placeholder={en ? 'Book title' : 'Titre du livre'} editable={editable} multiline={false} onCommit={(title) => { onChange?.({ title }); onBookChange?.({ title }); }} />
        <EditableText as="p" className="bk-cover-sub" value={book.subtitle} placeholder={en ? 'Years' : 'Années'} editable={editable} multiline={false} onCommit={(subtitle) => onBookChange?.({ subtitle })} />
      </div>
    );
  }

  if (page.kind === 'interactive') {
    return (
      <div className="bk-page bk-layout-interactive" style={style}>
        {text}
        {qrUrl ? <div className="bk-qr"><QRCodeSVG value={qrUrl} size={120} level="M" marginSize={1} /><small>{en ? 'Scan to watch and listen' : 'Scannez pour voir et écouter'}</small></div> : null}
        <span className="bk-folio">{index}</span>
      </div>
    );
  }

  const layout = page.kind === 'closing' ? 'minimal' : page.layout;
  return (
    <div className={`bk-page bk-layout-${layout}`} style={style}>
      {layout === 'editorial' ? <>{text}{photoArea}</> : <>{photoArea}{text}</>}
      <span className="bk-folio">{index}</span>
    </div>
  );
}
