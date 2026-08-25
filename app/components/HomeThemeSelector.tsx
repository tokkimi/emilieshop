'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

type HomeTheme = 'burgundy' | 'green' | 'navy';

const themes: HomeTheme[] = ['burgundy', 'green', 'navy'];
const storageKey = 'memoire-maison-home-theme';

export function HomeThemeSelector({ locale = 'fr' }: { locale?: 'fr' | 'en' }) {
  const [selected, setSelected] = useState<HomeTheme>('green');
  const en = locale === 'en';
  const pathname = usePathname();
  const isHome = pathname === '/' || pathname === '/en';

  useEffect(() => {
    if (!isHome) {
      themes.forEach((theme) => document.body.classList.remove(`home-theme-${theme}`));
      return;
    }
    const saved = window.localStorage.getItem(storageKey);
    const initial = themes.includes(saved as HomeTheme) ? (saved as HomeTheme) : 'green';
    document.body.classList.add(`home-theme-${initial}`);
    const stateTimer = window.setTimeout(() => setSelected(initial), 0);

    return () => {
      window.clearTimeout(stateTimer);
      themes.forEach((theme) => document.body.classList.remove(`home-theme-${theme}`));
    };
  }, [isHome]);

  function choose(theme: HomeTheme) {
    themes.forEach((item) => document.body.classList.remove(`home-theme-${item}`));
    document.body.classList.add(`home-theme-${theme}`);
    window.localStorage.setItem(storageKey, theme);
    setSelected(theme);
  }

  const labels: Record<HomeTheme, string> = en
    ? { burgundy: 'Burgundy', green: 'Green', navy: 'Midnight blue' }
    : { burgundy: 'Bordeaux', green: 'Vert', navy: 'Bleu nuit' };

  if (!isHome) return null;

  return (
    <div className="home-theme-selector" aria-label={en ? 'Choose the home page colour' : "Choisir la couleur de l’accueil"}>
      <span className="theme-selector-label">{en ? 'Mood' : 'Ambiance'}</span>
      <div role="group">
        {themes.map((theme) => (
          <button
            key={theme}
            type="button"
            className={`theme-choice theme-choice-${theme} ${selected === theme ? 'is-selected' : ''}`}
            onClick={() => choose(theme)}
            aria-label={labels[theme]}
            aria-pressed={selected === theme}
            title={labels[theme]}
          >
            <span className="sr-only">{labels[theme]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
