'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const SESSION_KEY = 'mm-visit';
const SKIP = /^\/(admin|demo|api)(\/|$)/;

/**
 * One anonymous id per browser session (sessionStorage, no cookie, gone when
 * the tab closes), so the dashboard counts visits and pages without following
 * anyone from one day to the next.
 */
function sessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'no-storage';
  }
}

export function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || SKIP.test(pathname) || navigator.webdriver) return;
    const params = new URLSearchParams(window.location.search);
    const body = JSON.stringify({
      visitorId: sessionId(),
      event: 'page_view',
      path: pathname,
      metadata: {
        referrer: document.referrer || null,
        utm_source: params.get('utm_source'),
        utm_medium: params.get('utm_medium'),
        utm_campaign: params.get('utm_campaign'),
        lang: pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'fr',
      },
    });
    // sendBeacon survives the page unloading; fetch keepalive is the fallback.
    const sent = navigator.sendBeacon?.('/api/events', new Blob([body], { type: 'application/json' }));
    if (!sent) fetch('/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => null);
  }, [pathname]);

  return null;
}
