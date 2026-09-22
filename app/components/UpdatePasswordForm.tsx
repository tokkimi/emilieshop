'use client';

import { FormEvent, useState } from 'react';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';

export function UpdatePasswordForm({ locale = 'fr' }: { locale?: 'fr' | 'en' }) {
  const en = locale === 'en';
  const t = (fr: string, enText: string) => (en ? enText : fr);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error' | 'unavailable'>('idle');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setStatus('error');
      setError(t('Au moins 8 caractères.', 'At least 8 characters.'));
      return;
    }
    if (password !== confirm) {
      setStatus('error');
      setError(t('Les mots de passe ne correspondent pas.', 'Passwords do not match.'));
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setStatus('unavailable');
      return;
    }
    setStatus('saving');
    setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setStatus('error');
      setError(
        en
          ? 'Could not update the password. Open the link from your email again.'
          : 'Impossible de mettre à jour le mot de passe. Rouvrez le lien reçu par courriel.',
      );
      return;
    }
    setStatus('done');
    setTimeout(() => window.location.assign(en ? '/en/profile' : '/profil'), 1200);
  }

  return (
    <form className="email-auth-form" onSubmit={submit}>
      <label>
        {t('Nouveau mot de passe', 'New password')}
        <input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t('Au moins 8 caractères', 'At least 8 characters')} />
      </label>
      <label>
        {t('Confirmer le mot de passe', 'Confirm password')}
        <input type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(event) => setConfirm(event.target.value)} />
      </label>
      <button className="button auth-primary" type="submit" disabled={status === 'saving' || status === 'done'}>
        {status === 'saving' ? t('Enregistrement…', 'Saving…') : status === 'done' ? t('Enregistré ✓', 'Saved ✓') : t('Enregistrer le mot de passe', 'Save password')}
      </button>
      {status === 'done' ? <p className="auth-feedback success" role="status">{t('Mot de passe mis à jour. Redirection…', 'Password updated. Redirecting…')}</p> : null}
      {status === 'error' ? <p className="auth-feedback error" role="alert">{error}</p> : null}
      {status === 'unavailable' ? <p className="auth-feedback error" role="alert">{t('Comptes non configurés.', 'Accounts not configured.')}</p> : null}
    </form>
  );
}
