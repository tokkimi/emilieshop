'use client';

import { FormEvent, useState } from 'react';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';

function safeNext(value: string | null, fallback: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}

export function EmailAuthForm({ locale = 'fr', fallback = '/profil' }: { locale?: 'fr' | 'en'; fallback?: string }) {
  const en = locale === 'en';
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error' | 'unavailable'>('idle');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setStatus('unavailable');
      return;
    }
    setStatus('sending');
    const next = safeNext(new URL(window.location.href).searchParams.get('next'), fallback);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
    setStatus(error ? 'error' : 'sent');
  }

  return <form className="email-auth-form" onSubmit={submit}>
    <label htmlFor={`account-email-${locale}`}>{en ? 'Email address' : 'Adresse courriel'}</label>
    <div><input id={`account-email-${locale}`} type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder={en ? 'you@example.com' : 'vous@exemple.ca'} /><button className="button" type="submit" disabled={status === 'sending' || status === 'sent'}>{status === 'sending' ? (en ? 'Sending…' : 'Envoi…') : status === 'sent' ? (en ? 'Link sent ✓' : 'Lien envoyé ✓') : (en ? 'Continue securely →' : 'Continuer en sécurité →')}</button></div>
    {status === 'sent' ? <p className="auth-feedback success" role="status">{en ? 'Check your inbox. The secure link signs you in or creates your account.' : 'Consultez votre boîte courriel. Le lien sécurisé vous connecte ou crée votre compte.'}</p> : null}
    {status === 'error' ? <p className="auth-feedback error" role="alert">{en ? 'The link could not be sent. Please try again.' : 'Le lien n’a pas pu être envoyé. Réessayez.'}</p> : null}
    {status === 'unavailable' ? <p className="auth-feedback error" role="alert">{en ? 'Cloud accounts are awaiting final configuration. The test profile remains available below.' : 'Les comptes cloud attendent la configuration finale. Le profil test reste accessible ci-dessous.'}</p> : null}
    <small>{en ? 'No password to remember. The link expires automatically.' : 'Aucun mot de passe à retenir. Le lien expire automatiquement.'}</small>
  </form>;
}
