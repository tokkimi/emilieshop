'use client';

import { FormEvent, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';

function safeNext(value: string | null, fallback: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}

function mapError(message: string, en: boolean): string {
  const m = (message || '').toLowerCase();
  if (m.includes('provider is not enabled') || m.includes('unsupported provider'))
    return en ? 'Google sign-in is not activated yet.' : 'La connexion Google n’est pas encore activée.';
  if (m.includes('invalid login') || m.includes('invalid credentials'))
    return en ? 'Incorrect email or password.' : 'Courriel ou mot de passe incorrect.';
  if (m.includes('already registered') || m.includes('already exists') || m.includes('user already'))
    return en ? 'An account already exists for this email. Try signing in.' : 'Un compte existe déjà pour ce courriel. Essayez de vous connecter.';
  if (m.includes('password') && (m.includes('at least') || m.includes('should be') || m.includes('6 char')))
    return en ? 'Password must be at least 8 characters.' : 'Le mot de passe doit comporter au moins 8 caractères.';
  if (m.includes('email not confirmed'))
    return en ? 'Please confirm your email first (check your inbox).' : 'Confirmez d’abord votre courriel (vérifiez votre boîte de réception).';
  return en ? 'Something went wrong. Please try again.' : 'Une erreur est survenue. Réessayez.';
}

// Mirror the profile upsert done by the auth callback, for the case where a
// password sign-up returns a session immediately (email confirmation disabled).
async function ensureProfile(supabase: SupabaseClient) {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user?.email) return;
    const fullName =
      typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name
        ? user.user_metadata.full_name
        : user.email.split('@')[0];
    await supabase.from('profiles').upsert(
      { id: user.id, email: user.email, display_name: fullName, updated_at: new Date().toISOString() },
      { onConflict: 'id' },
    );
  } catch {
    // Best effort: the callback also creates the profile on the confirmation flow.
  }
}

type Mode = 'signin' | 'signup';
type Status = 'idle' | 'sending' | 'confirm' | 'reset' | 'error' | 'unavailable';

export function EmailAuthForm({ locale = 'fr', fallback = '/profil' }: { locale?: 'fr' | 'en'; fallback?: string }) {
  const en = locale === 'en';
  const t = (fr: string, enText: string) => (en ? enText : fr);
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true';

  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  function currentNext() {
    return safeNext(new URL(window.location.href).searchParams.get('next'), fallback);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setStatus('idle');
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setStatus('unavailable');
      return;
    }
    setStatus('sending');
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    const next = currentNext();

    if (mode === 'signup') {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: name.trim() ? { full_name: name.trim() } : undefined,
        },
      });
      if (signUpError) {
        setStatus('error');
        setError(mapError(signUpError.message, en));
        return;
      }
      if (data.session) {
        await ensureProfile(supabase);
        window.location.assign(next);
        return;
      }
      setStatus('confirm');
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    if (signInError) {
      setStatus('error');
      setError(mapError(signInError.message, en));
      return;
    }
    await ensureProfile(supabase);
    window.location.assign(next);
  }

  async function googleSignIn() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setStatus('unavailable');
      return;
    }
    setStatus('sending');
    setError('');
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(currentNext())}`;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (oauthError) {
      setStatus('error');
      setError(mapError(oauthError.message, en));
    }
  }

  async function forgotPassword() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setStatus('unavailable');
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setStatus('error');
      setError(t('Entrez d’abord votre adresse courriel.', 'Enter your email address first.'));
      return;
    }
    setStatus('sending');
    setError('');
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(en ? '/en/account/password' : '/compte/mot-de-passe')}`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
    if (resetError) {
      setStatus('error');
      setError(mapError(resetError.message, en));
      return;
    }
    setStatus('reset');
  }

  const busy = status === 'sending';

  return (
    <div className="email-auth">
      {googleEnabled ? (
        <>
          <button className="google-auth-button" type="button" onClick={googleSignIn} disabled={busy}>
            <span>G</span>
            {t('Continuer avec Google', 'Continue with Google')}
          </button>
          <div className="auth-or"><span>{t('ou', 'or')}</span></div>
        </>
      ) : null}

      <div className="auth-toggle" role="tablist" aria-label={t('Choix de connexion', 'Sign-in choice')}>
        <button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'active' : ''} onClick={() => switchMode('signin')}>
          {t('Se connecter', 'Sign in')}
        </button>
        <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} onClick={() => switchMode('signup')}>
          {t('Créer un compte', 'Create account')}
        </button>
      </div>

      <form className="email-auth-form" onSubmit={submit}>
        {mode === 'signup' ? (
          <label>
            {t('Nom complet', 'Full name')}
            <input type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder={t('Prénom et nom', 'First and last name')} />
          </label>
        ) : null}

        <label>
          {t('Adresse courriel', 'Email address')}
          <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t('vous@exemple.ca', 'you@example.com')} />
        </label>

        <label>
          {t('Mot de passe', 'Password')}
          <input
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t('Au moins 8 caractères', 'At least 8 characters')}
          />
        </label>

        {mode === 'signin' ? (
          <button type="button" className="auth-forgot" onClick={forgotPassword} disabled={busy}>
            {t('Mot de passe oublié ?', 'Forgot password?')}
          </button>
        ) : null}

        <button className="button auth-primary" type="submit" disabled={busy}>
          {busy
            ? t('Un instant…', 'One moment…')
            : mode === 'signup'
              ? t('Créer mon compte', 'Create my account')
              : t('Se connecter', 'Sign in')}
        </button>

        {status === 'confirm' ? (
          <p className="auth-feedback success" role="status">
            {t('Compte créé. Vérifiez votre boîte courriel pour confirmer votre adresse.', 'Account created. Check your inbox to confirm your address.')}
          </p>
        ) : null}
        {status === 'reset' ? (
          <p className="auth-feedback success" role="status">
            {t('Courriel envoyé. Suivez le lien pour choisir un nouveau mot de passe.', 'Email sent. Follow the link to choose a new password.')}
          </p>
        ) : null}
        {status === 'error' ? (
          <p className="auth-feedback error" role="alert">{error || t('Une erreur est survenue. Réessayez.', 'Something went wrong. Please try again.')}</p>
        ) : null}
        {status === 'unavailable' ? (
          <p className="auth-feedback error" role="alert">
            {t('Les comptes ne sont pas encore configurés. Réessayez plus tard.', 'Accounts are not configured yet. Please try again later.')}
          </p>
        ) : null}
      </form>

      <small className="auth-switch">
        {mode === 'signin'
          ? t('Pas encore de compte ? ', 'No account yet? ')
          : t('Vous avez déjà un compte ? ', 'Already have an account? ')}
        <button type="button" onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? t('Créer un compte', 'Create one') : t('Se connecter', 'Sign in')}
        </button>
      </small>
    </div>
  );
}
