'use client';

import { FormEvent, useState } from 'react';

export function NewsletterForm({ locale }: { locale: 'fr' | 'en' }) {
  const en = locale === 'en';
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consent) return;
    setStatus('sending');
    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, locale, consent: true, segment: 'owner' }),
      });
      if (!response.ok) throw new Error('subscription');
      setEmail('');
      setConsent(false);
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }

  return (
    <form className="newsletter-form" onSubmit={subscribe}>
      <div className="newsletter">
        <label className="sr-only" htmlFor={`newsletter-email-${locale}`}>{en ? 'Your email' : 'Votre courriel'}</label>
        <input id={`newsletter-email-${locale}`} type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder={en ? 'Your email' : 'Votre courriel'} />
        <button type="submit" disabled={status === 'sending'} aria-label={en ? 'Subscribe' : 'S’inscrire'}>{status === 'sending' ? '…' : '→'}</button>
      </div>
      <label className="newsletter-consent"><input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} /> <span>{en ? 'I agree to receive the newsletter. Unsubscribe anytime.' : 'J’accepte de recevoir l’infolettre. Désabonnement en tout temps.'}</span></label>
      {status === 'success' ? <small className="newsletter-status success" role="status">{en ? 'You are subscribed. Thank you.' : 'Votre inscription est confirmée. Merci.'}</small> : null}
      {status === 'error' ? <small className="newsletter-status error" role="alert">{en ? 'Something went wrong. Please try again.' : 'Un problème est survenu. Réessayez.'}</small> : null}
    </form>
  );
}
