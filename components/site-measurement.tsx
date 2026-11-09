"use client";

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { canMeasure, CONSENT_KEY, CONSENT_EVENT, track } from '@/lib/measurement';

export function SiteMeasurement() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || /^\/(admin|console|api|memory)(\/|$)/.test(pathname) || /^\/en\/memory(\/|$)/.test(pathname)) return;
    const page = () => { if (canMeasure()) track('page_view'); };
    page();
    window.addEventListener(CONSENT_EVENT, page);
    return () => window.removeEventListener(CONSENT_EVENT, page);
  }, [pathname]);
  return null;
}

export function MeasurementConsent() {
  const pathname = usePathname();
  const en = pathname === '/en' || pathname?.startsWith('/en/');
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try { setVisible(!localStorage.getItem(CONSENT_KEY)); } catch { /* Storage unavailable. */ }
  }, []);

  function choose(value: 'allow' | 'essential') {
    const wasAllowed = canMeasure();
    try {
      localStorage.setItem(CONSENT_KEY, value);
      document.cookie = `measurement_consent=${value}; path=/; max-age=31536000; samesite=lax; secure`;
    } catch { return; }
    setVisible(false);
    if (value === 'allow') window.dispatchEvent(new Event(CONSENT_EVENT));
    else if (wasAllowed) window.location.reload();
  }

  const label = en ? 'Cookie preferences' : 'Préférences des témoins';
  const button = { minHeight: 44, borderRadius: 24, padding: '10px 18px', cursor: 'pointer', font: 'inherit', fontSize: 13 };
  if (!visible) return <button type="button" onClick={() => setVisible(true)} style={{ position: 'fixed', bottom: 10, left: 10, zIndex: 70, border: '1px solid #d8dce3', borderRadius: 24, background: 'white', color: '#1d293e', padding: '8px 12px', fontSize: 11, cursor: 'pointer' }}>{label}</button>;
  return <aside aria-label={label} style={{ position: 'fixed', bottom: 'max(12px, env(safe-area-inset-bottom))', left: 12, right: 12, margin: '0 auto', maxWidth: 760, maxHeight: '70dvh', overflowY: 'auto', zIndex: 100, border: '1px solid #e1e4e9', borderRadius: 20, padding: 22, background: '#fff', color: '#1d293e', boxShadow: '0 8px 40px #14233c26' }}>
    <strong style={{ display: 'block', marginBottom: 8 }}>{en ? 'Your privacy choices' : 'Vos choix de confidentialité'}</strong>
    <p style={{ fontSize: 14, lineHeight: 1.6, margin: '0 0 16px' }}>{en ? 'Essential cookies support your account and site security. With your permission, the Meta pixel measures visits and advertising performance. You can refuse or change your choice at any time.' : 'Les témoins essentiels permettent la connexion et la sécurité du site. Avec votre accord, le pixel Meta mesure les visites et les résultats publicitaires. Vous pouvez refuser ou modifier votre choix à tout moment.'}</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      <button type="button" onClick={() => choose('allow')} style={{ ...button, border: '1px solid #1d293e', background: '#1d293e', color: 'white' }}>{en ? 'Accept measurement' : 'Autoriser la mesure'}</button>
      <button type="button" onClick={() => choose('essential')} style={{ ...button, border: '1px solid #1d293e', background: 'white', color: '#1d293e' }}>{en ? 'Essential only' : 'Essentiels uniquement'}</button>
    </div>
  </aside>;
}
