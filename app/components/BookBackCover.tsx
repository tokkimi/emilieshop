'use client';
import type { GeneratedBook } from '../../lib/book';
import { coverColor } from '../../lib/book-design';
export function BookBackCover({ book }: { book: GeneratedBook }) {
  const color = coverColor(book.coverColor);
  return <div className="bk-page bk-back-cover" style={{ '--bk-bg': color.bg, '--bk-ink': color.ink } as React.CSSProperties}>
    <p>{book.locale === 'en' ? 'Every home has a story.' : 'Chaque maison a une histoire.'}</p>
    <div className="bk-back-brand"><img src="/memoire-maison-logo.png" alt="Mémoire Maison"/></div>
  </div>;
}
