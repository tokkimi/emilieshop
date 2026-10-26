'use client';
import { useEffect, useRef, useState } from 'react';
import Link from './SafeLink';
import './book-showcase.css';

const stories = [
  { fr: 'Notre Première Maison', en: 'Our First Home', color: 'ivory', photo: '/quebec-home-v2.jpg' },
  { fr: 'Notre Maison', en: 'Our Home', color: 'wine', photo: '/family-memories-v2.jpg' },
  { fr: 'Maison de Famille', en: 'Family Home', color: 'night', photo: '/memory-book-hero-v2.jpg' },
] as const;
const orbitPhotos = ['/quebec-home-v2.jpg', '/family-memories-v2.jpg', '/memory-book-hero-v2.jpg', '/memory-book-collection-v2.jpg', '/memory-link-v2.jpg'];
const ORBIT_CARDS = 20;

export function BookShowcase({ locale = 'fr' }: { locale?: 'fr' | 'en' }) {
  const en = locale === 'en';
  const section = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(0);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const element = section.current;
    if (!element) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let visible = false;
    const update = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      const stage = element.querySelector<HTMLElement>('.showcase-stage')!;
      const width = stage.clientWidth, height = stage.clientHeight;
      const progress = reduced.matches ? .65 : Math.max(0, Math.min(1, -rect.top / Math.max(1, rect.height - height)));
      const morph = Math.max(0, Math.min(1, (progress - .15) / .45));
      const eased = morph * morph * (3 - 2 * morph);
      element.querySelectorAll<HTMLElement>('.showcase-books, .showcase-stage > .quiet-link').forEach((node) => { node.inert = morph < .7; });
      element.style.setProperty('--text-in', String(Math.max(0, Math.min(1, (morph - .6) / .4))));
      element.style.setProperty('--text-out', String(Math.max(0, 1 - morph * 3)));
      // Cards start as a closed ring, then unfold into a wide arc below the text.
      const ring = Math.min(width * .36, height * .32, 290);
      const arc = Math.max(width * .8, height * .75);
      const drift = Math.max(0, (progress - .6) / .4) * 65;
      element.querySelectorAll<HTMLElement>('.showcase-orbit-card').forEach((card, index) => {
        const ringAngle = index / ORBIT_CARDS * 360;
        const ringRad = ringAngle * Math.PI / 180;
        const arcAngle = -155 + index / (ORBIT_CARDS - 1) * 130 - drift;
        const arcRad = arcAngle * Math.PI / 180;
        const x = Math.cos(ringRad) * ring * (1 - eased) + Math.cos(arcRad) * arc * eased;
        const y = Math.sin(ringRad) * ring * (1 - eased) + (Math.sin(arcRad) * arc + arc + height * .22) * eased;
        card.style.transform = `translate(-50%,-50%) translate3d(${x}px,${y}px,0) rotate(${(ringAngle + 90) * (1 - eased) + (arcAngle + 90) * eased}deg) scale(${1 + eased * .35})`;
      });
    };
    const request = () => { if (visible && !frame) frame = requestAnimationFrame(update); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) request(); }, { rootMargin: '100px' });
    observer.observe(element);
    update();
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    reduced.addEventListener('change', update);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', request);
      window.removeEventListener('resize', request);
      reduced.removeEventListener('change', update);
    };
  }, []);

  const story = stories[selected];
  return (
    <section ref={section} className="book-showcase" aria-labelledby="showcase-title">
      <div className="showcase-stage">
        <div className="showcase-intro">
          <p className="eyebrow">MÉMOIRE MAISON</p>
          <h1>{en ? 'A life of memories.' : 'Une vie de souvenirs.'}</h1>
          <p>{en ? 'Scroll to discover' : 'Faites défiler pour découvrir'} ↓</p>
        </div>
        <header>
          <p className="eyebrow">{en ? 'Your memories, beautifully bound' : 'Vos souvenirs, reliés pour toujours'}</p>
          <h2 id="showcase-title">{en ? 'Every home.' : 'Chaque maison.'}<br /><em>{en ? 'Its own book.' : 'Son propre livre.'}</em></h2>
          <p>{en ? 'Your photographs. Your words. A book unlike any other.' : 'Vos photos. Vos mots. Un livre qui ne ressemble qu’à vous.'}</p>
        </header>
        <div className="showcase-books">
          {stories.map((item, index) => (
            <button key={item.color} className={`showcase-book ${item.color} book-${index}`} onClick={() => { setSelected(index); setPage(0); dialog.current?.showModal(); }} aria-label={`${en ? 'Browse the example' : 'Feuilleter l’exemple'} : ${item[locale]}`}>
              <span className="showcase-cover">
                <span className="cover-edition">MÉMOIRE MAISON</span>
                <span className="cover-title">{item[locale]}</span>
                <span className="cover-photo"><img src={item.photo} alt="" loading="lazy" width="360" height="440" /></span>
                <span className="cover-subtitle">{en ? 'The places we carry with us' : 'Les lieux que l’on garde en soi'}</span>
              </span>
              <span className="showcase-browse">{item[locale]} <span aria-hidden="true">↗︎</span></span>
            </button>
          ))}
        </div>
        <p className="showcase-note">{en ? 'Illustrative examples · Tap a cover to explore' : 'Exemples de présentation · Touchez un livre pour le découvrir'}</p>
        <Link className="quiet-link" href={en ? '/en/studio' : '/atelier'}>{en ? 'Create my own story' : 'Créer ma propre histoire'} <span aria-hidden="true">→</span></Link>
        <div className="showcase-orbit" aria-hidden="true">
          {Array.from({ length: ORBIT_CARDS }, (_, index) => (
            <div key={index} className="showcase-orbit-card"><img src={orbitPhotos[index % orbitPhotos.length]} alt="" width="120" height="170" /></div>
          ))}
        </div>
      </div>
      <dialog ref={dialog} className="showcase-dialog" aria-labelledby="example-title" onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
        <div className="example-heading">
          <div><p className="eyebrow">{en ? 'Illustrative example' : 'Exemple de présentation'}</p><h3 id="example-title">{story[locale]}</h3></div>
          <button onClick={() => dialog.current?.close()} aria-label={en ? 'Close preview' : 'Fermer l’aperçu'}>×</button>
        </div>
        <div className="example-spread" key={`${selected}-${page}`}>
          <img src={page === 0 ? story.photo : '/family-memories-v2.jpg'} alt={en ? 'Illustrative home memories' : 'Illustration de souvenirs de maison'} width="600" height="700" />
          <div>
            <p className="eyebrow">{page === 0 ? '01' : '02'}</p>
            <h4>{page === 0 ? (en ? 'Where it all began.' : 'Là où tout a commencé.') : (en ? 'The little things.' : 'Les petits riens.')}</h4>
            <p>{page === 0
              ? (en ? 'The first key. The light through the windows. That feeling of finally being home.' : 'La première clé. La lumière aux fenêtres. Cette sensation d’être enfin chez soi.')
              : (en ? 'Sunday mornings, shared meals, laughter in the hallway. Everything that made this house our home.' : 'Les dimanches matin, les repas partagés, les rires dans le couloir. Tout ce qui a fait de cette maison la nôtre.')}</p>
            <small>{en ? 'Your own photos and story will take their place here.' : 'Vos propres photos et votre récit prendront place ici.'}</small>
          </div>
        </div>
        <div className="example-controls">
          <button disabled={page === 0} onClick={() => setPage(0)} aria-label={en ? 'Previous spread' : 'Double page précédente'}>←</button>
          <span aria-live="polite">{page + 1} / 2</span>
          <button disabled={page === 1} onClick={() => setPage(1)} aria-label={en ? 'Next spread' : 'Double page suivante'}>→</button>
        </div>
      </dialog>
    </section>
  );
}
