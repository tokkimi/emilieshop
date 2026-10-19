'use client';

import { useEffect, useState } from 'react';
import { readJson } from './format';
import './admin-tools.css';

type SeoPage = { path: string; label: string; defaults: { title: string; description: string } };
type Override = { title?: string; description?: string; noindex?: boolean };
type Payload = { pages: SeoPage[]; settings: { pages: Record<string, Override>; googleVerification?: string } };

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 155;

/** Edit how each public page appears in Google, with a live preview. */
export function SeoManager() {
  const [data, setData] = useState<Payload | null>(null);
  const [draft, setDraft] = useState<Record<string, Override>>({});
  const [verification, setVerification] = useState('');
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/admin/seo')
      .then((response) => readJson<Payload>(response))
      .then((value) => {
        setData(value);
        setDraft(value.settings.pages || {});
        setVerification(value.settings.googleVerification || '');
      })
      .catch((reason: Error) => setNotice({ text: reason.message, error: true }));
  }, []);

  const update = (path: string, patch: Override) => setDraft((current) => ({ ...current, [path]: { ...current[path], ...patch } }));
  const save = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await readJson(
        await fetch('/api/admin/seo', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ pages: draft, googleVerification: verification.trim() || undefined }),
        }),
      );
      setNotice({ text: 'Référencement enregistré. Les pages sont mises à jour tout de suite ; Google les relira à son prochain passage.' });
    } catch (reason) {
      setNotice({ text: (reason as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  };

  if (!data) return notice ? <p className="at-notice error">{notice.text}</p> : <article className="at-panel"><p className="at-empty">Chargement…</p></article>;
  return (
    <div className="admin-module">
      <article className="at-panel">
        <h2>Comment ça marche</h2>
        <p className="at-sub" style={{ marginBottom: 0 }}>
          Le titre et la description sont ce que Google affiche dans ses résultats. Laissez un champ vide pour garder le texte d’origine. Titre : {TITLE_MAX} caractères conseillés · description : {DESCRIPTION_MAX}.
        </p>
      </article>
      {data.pages.map((page) => {
        const value = draft[page.path] || {};
        const title = value.title ?? '';
        const description = value.description ?? '';
        const shownTitle = title.trim() || page.defaults.title;
        const shownDescription = description.trim() || page.defaults.description;
        return (
          <article className="at-panel" key={page.path}>
            <h2>{page.label}</h2>
            <p className="at-sub">memoiremaison.com{page.path === '/' ? '' : page.path}</p>
            <div className="at-grid">
              <div className="at-form">
                <label>
                  Titre dans Google
                  <input value={title} maxLength={70} placeholder={page.defaults.title} onChange={(event) => update(page.path, { title: event.target.value })} />
                  <span className={`hint ${shownTitle.length > TITLE_MAX ? 'over' : ''}`}>{shownTitle.length} / {TITLE_MAX}</span>
                </label>
                <label>
                  Description
                  <textarea rows={3} value={description} maxLength={170} placeholder={page.defaults.description} onChange={(event) => update(page.path, { description: event.target.value })} />
                  <span className={`hint ${shownDescription.length > DESCRIPTION_MAX ? 'over' : ''}`}>{shownDescription.length} / {DESCRIPTION_MAX}</span>
                </label>
                <label className="check">
                  <input type="checkbox" checked={Boolean(value.noindex)} onChange={(event) => update(page.path, { noindex: event.target.checked })} />
                  Masquer cette page de Google
                </label>
              </div>
              <div>
                <p className="at-sub">Aperçu dans Google</p>
                <div className="at-serp">
                  <small>memoiremaison.com{page.path === '/' ? '' : ` › ${page.path.replace(/^\//, '').replaceAll('/', ' › ')}`}</small>
                  <b>{shownTitle}</b>
                  <p>{shownDescription.length > DESCRIPTION_MAX ? `${shownDescription.slice(0, DESCRIPTION_MAX)}…` : shownDescription}</p>
                </div>
              </div>
            </div>
          </article>
        );
      })}
      <article className="at-panel">
        <h2>Google Search Console</h2>
        <p className="at-sub">Pour suivre vos positions dans Google : dans Search Console, choisissez la validation par « balise HTML » et collez ici uniquement le code (la valeur de content=…).</p>
        <div className="at-form">
          <label>Code de validation Google<input value={verification} onChange={(event) => setVerification(event.target.value)} placeholder="ex. AbC123xyz…" /></label>
          <p className="hint">Plan du site à déclarer dans Search Console : https://memoiremaison.com/sitemap.xml</p>
        </div>
      </article>
      {notice ? <p className={`at-notice ${notice.error ? 'error' : ''}`}>{notice.text}</p> : null}
      <div className="at-actions"><button className="at-btn primary" type="button" disabled={busy} onClick={save}>{busy ? 'Enregistrement…' : 'Enregistrer le référencement'}</button></div>
    </div>
  );
}
