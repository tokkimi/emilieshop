'use client';

import { FormEvent, useEffect, useState } from 'react';
import { readJson } from './format';
import './admin-tools.css';

type Access = { owner: boolean; owners: string[]; testAdmins: string[]; dashboardAdmins: string[] };

function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

/** Paramètres → who can open the admin; the owner can add or remove people. */
export function AdminAccess() {
  const [access, setAccess] = useState<Access | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () =>
    fetch('/api/admin/admins')
      .then((response) => readJson<Access>(response))
      .then(setAccess)
      .catch((reason: Error) => setNotice({ text: reason.message, error: true }));
  useEffect(() => {
    void load();
  }, []);

  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setNotice(null);
    try {
      const result = await readJson<{ email: string; created: boolean }>(
        await fetch('/api/admin/admins', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: form.get('email'), name: form.get('name') || undefined, password: password || undefined }),
        }),
      );
      setNotice({
        text: result.created
          ? `Compte créé : ${result.email} avec le mot de passe affiché. Notez-le maintenant, il ne sera plus montré. Connexion sur memoiremaison.com/connexion puis /admin.`
          : `${result.email} a maintenant accès à l’admin (compte existant : son mot de passe ne change pas).`,
      });
      formElement.reset();
      void load();
    } catch (reason) {
      setNotice({ text: (reason as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (email: string) => {
    if (!window.confirm(`Retirer l’accès admin de ${email} ?`)) return;
    try {
      await readJson(await fetch(`/api/admin/admins?email=${encodeURIComponent(email)}`, { method: 'DELETE' }));
      void load();
    } catch (reason) {
      setNotice({ text: (reason as Error).message, error: true });
    }
  };

  return (
    <div className="admin-module">
      <article className="at-panel">
        <h2>Accès administrateur</h2>
        <p className="at-sub">Les personnes qui peuvent ouvrir memoiremaison.com/admin</p>
        {!access ? (
          <p className="at-empty">Chargement…</p>
        ) : (
          <table className="at-table">
            <tbody>
              {access.owners.map((email) => <tr key={email}><td>{email}</td><td><span className="at-pill good">Propriétaire</span></td><td /></tr>)}
              {access.testAdmins.map((email) => <tr key={email}><td>{email}</td><td><span className="at-pill">Admin (réglage Vercel)</span></td><td /></tr>)}
              {access.dashboardAdmins.map((email) => (
                <tr key={email}>
                  <td>{email}</td>
                  <td><span className="at-pill">Admin</span></td>
                  <td className="num">{access.owner ? <button className="at-btn danger" type="button" onClick={() => void remove(email)}>Retirer</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
      {access?.owner ? (
        <form className="at-panel at-form" onSubmit={add}>
          <h2>Ajouter un administrateur</h2>
          <p className="at-sub">Avec un mot de passe, le compte est créé et utilisable tout de suite. Sans mot de passe, la personne doit déjà avoir un compte client.</p>
          <div className="row">
            <label>Courriel<input name="email" type="email" required placeholder="test@memoiremaison.com" /></label>
            <label>Nom (facultatif)<input name="name" placeholder="Compte de test" /></label>
          </div>
          <label>
            Mot de passe (10 caractères minimum)
            <div className="at-actions">
              <input value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} style={{ flex: 1 }} autoComplete="new-password" />
              <button className="at-btn" type="button" onClick={() => setPassword(generatePassword())}>Générer</button>
            </div>
          </label>
          <div className="at-actions"><button className="at-btn primary" disabled={busy}>{busy ? 'Création…' : 'Donner l’accès admin'}</button></div>
        </form>
      ) : access ? (
        <p className="at-notice">Seule la propriétaire peut ajouter ou retirer des administrateurs.</p>
      ) : null}
      {notice ? <p className={`at-notice ${notice.error ? 'error' : ''}`}>{notice.text}</p> : null}
    </div>
  );
}
