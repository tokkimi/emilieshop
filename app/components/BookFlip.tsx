'use client';

import { useEffect, useMemo, useState } from 'react';
import type { GeneratedBook } from '../../lib/book';
import { BookPageView } from './BookPageView';

type Turn = { dir: 1 | -1; to: number } | null;

// Feuilletage : couverture seule, puis doubles pages avec effet de page qui tourne.
export function BookFlip({ book, photoUrl, qrUrl, en, onClose }: { book: GeneratedBook; photoUrl: (id: string) => string | undefined; qrUrl?: string; en: boolean; onClose: () => void }) {
  const spreads = useMemo(() => {
    const list: (number | null)[][] = [[null, 0]];
    for (let index = 1; index < book.pages.length; index += 2) list.push([index, index + 1 < book.pages.length ? index + 1 : null]);
    return list;
  }, [book.pages.length]);
  const [current, setCurrent] = useState(0);
  const [turn, setTurn] = useState<Turn>(null);

  const go = (dir: 1 | -1) => {
    if (turn) return;
    const to = current + dir;
    if (to < 0 || to >= spreads.length) return;
    setTurn({ dir, to });
    window.setTimeout(() => { setCurrent(to); setTurn(null); }, 750);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') go(1);
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const page = (index: number | null | undefined) =>
    index === null || index === undefined ? <div className="bf-blank" /> : <div className="bf-page"><BookPageView page={book.pages[index]} book={book} index={index} photoUrl={photoUrl} qrUrl={qrUrl} en={en} /></div>;

  const [left, right] = spreads[current];
  const target = turn ? spreads[turn.to] : null;
  // Pendant le mouvement : dessous = pages finales visibles, la feuille tourne par-dessus.
  const baseLeft = turn?.dir === -1 ? target![0] : left;
  const baseRight = turn?.dir === 1 ? target![1] : right;
  const coverOnly = !turn && current === 0;

  return (
    <div className="bf-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="bf-stage" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="bf-close" onClick={onClose} aria-label={en ? 'Close' : 'Fermer'}>×</button>
        <div className={`bf-book ${coverOnly ? 'cover-only' : ''}`}>
          <div className="bf-side bf-left" onClick={() => go(-1)}>{page(baseLeft)}</div>
          <div className="bf-side bf-right" onClick={() => go(1)}>{page(baseRight)}</div>
          {turn ? (
            <div className={`bf-leaf ${turn.dir === 1 ? 'forward' : 'backward'}`}>
              <div className="bf-face bf-front">{turn.dir === 1 ? page(right) : page(left)}</div>
              <div className="bf-face bf-back">{turn.dir === 1 ? page(target![0]) : page(target![1])}</div>
            </div>
          ) : null}
        </div>
        <div className="bf-controls">
          <button type="button" onClick={() => go(-1)} disabled={current === 0}>←</button>
          <span>{current === 0 ? (en ? 'Cover' : 'Couverture') : `${en ? 'Pages' : 'Pages'} ${spreads[current].filter((v) => v !== null).join('–')}`}</span>
          <button type="button" onClick={() => go(1)} disabled={current === spreads.length - 1}>→</button>
        </div>
      </div>
    </div>
  );
}
