'use client';

import { FormEvent, useEffect, useState } from 'react';
import { money, readJson } from './format';
import './admin-tools.css';

type Usage = { projects: number; orders: number; revenueCents: number };
type Payload = {
  prodigi: { configured: boolean; environment: string; ordersEnabled: boolean; sku: string; description?: string; printAreas?: string[]; bookCost?: string; shippingCost?: string; currency?: string; error?: string };
  mpix: { bookCents: number; shippingCents: number; note: string };
  usage: { mpix: Usage; prodigi: Usage };
};

const dollarsToCents = (value: FormDataEntryValue | null) => Math.round(Number(String(value || '0').replace(',', '.')) * 100);
const amountToCents = (value?: string) => (value ? Math.round(Number(value) * 100) : null);

/** Mpix vs Prodigi: cost of one book shipped to Canada, and how many books each one makes. */
export function PrinterComparison() {
  const [data, setData] = useState<Payload | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/admin/printers')
      .then((response) => readJson<Payload>(response))
      .then(setData)
      .catch((reason: Error) => setNotice({ text: reason.message, error: true }));
  }, []);

  const saveMpix = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setNotice(null);
    try {
      const { mpix } = await readJson<{ mpix: Payload['mpix'] }>(
        await fetch('/api/admin/printers', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ bookCents: dollarsToCents(form.get('book')), shippingCents: dollarsToCents(form.get('shipping')), note: String(form.get('note') || '') }),
        }),
      );
      setData((current) => (current ? { ...current, mpix } : current));
      setNotice({ text: 'Prix Mpix enregistrés.' });
    } catch (reason) {
      setNotice({ text: (reason as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  };

  if (!data) return notice ? <p className="at-notice error">{notice.text}</p> : <article className="at-panel"><p className="at-empty">Chargement des imprimeurs…</p></article>;

  const prodigiBook = amountToCents(data.prodigi.bookCost);
  const prodigiShipping = amountToCents(data.prodigi.shippingCost);
  const prodigiTotal = prodigiBook !== null ? prodigiBook + (prodigiShipping || 0) : null;
  const mpixTotal = data.mpix.bookCents ? data.mpix.bookCents + data.mpix.shippingCents : null;
  const cheaper = data.prodigi.currency === 'CAD' && prodigiTotal !== null && mpixTotal !== null ? (prodigiTotal < mpixTotal ? 'Prodigi' : prodigiTotal > mpixTotal ? 'Mpix' : null) : null;
  const prodigiState = !data.prodigi.configured
    ? 'Clé API à ajouter (PRODIGI_API_KEY)'
    : data.prodigi.error
      ? `Erreur : ${data.prodigi.error}`
      : `Connecté · ${data.prodigi.environment === 'live' ? 'réel' : 'mode test'}${data.prodigi.ordersEnabled ? ' · envoi activé' : ' · envoi verrouillé'}`;

  return (
    <div className="admin-module">
      <article className="at-panel">
        <h2>Comparer Mpix et Prodigi</h2>
        <p className="at-sub">Coûts fournisseurs dans la devise affichée ; les taxes finales dépendent de l’adresse. Livre de 24 pages livré au Canada, et livres faits avec chaque imprimeur.{cheaper ? ` Aujourd’hui, ${cheaper} est le moins cher.` : ''}</p>
        <div className="at-scroll">
          <table className="at-table">
            <thead>
              <tr><th></th><th>Mpix</th><th>Prodigi</th></tr>
            </thead>
            <tbody>
              <tr><td>Connexion</td><td>Commande passée à la main sur mpix.com</td><td>{prodigiState}</td></tr>
              <tr><td>Livre</td><td>{data.mpix.bookCents ? money(data.mpix.bookCents) : 'Prix à saisir'}</td><td>{prodigiBook !== null ? `${data.prodigi.bookCost} ${data.prodigi.currency}` : '—'}</td></tr>
              <tr><td>Livraison</td><td>{data.mpix.bookCents ? money(data.mpix.shippingCents) : '—'}</td><td>{prodigiShipping !== null ? `${data.prodigi.shippingCost} ${data.prodigi.currency}` : '—'}</td></tr>
              <tr><td><b>Total</b></td><td><b>{mpixTotal !== null ? money(mpixTotal) : '—'}</b></td><td><b>{prodigiTotal !== null ? `${(prodigiTotal/100).toFixed(2)} ${data.prodigi.currency}` : '—'}</b></td></tr>
              <tr><td>Produit</td><td>{data.mpix.note || '—'}</td><td>{data.prodigi.description || data.prodigi.sku}</td></tr>
              <tr><td>Livres créés</td><td>{data.usage.mpix.projects}</td><td>{data.usage.prodigi.projects}</td></tr>
              <tr><td>Commandes payées</td><td>{data.usage.mpix.orders}</td><td>{data.usage.prodigi.orders}</td></tr>
              <tr><td>Chiffre d’affaires</td><td>{money(data.usage.mpix.revenueCents)}</td><td>{money(data.usage.prodigi.revenueCents)}</td></tr>
            </tbody>
          </table>
        </div>
      </article>
      <article className="at-panel">
        <h2>Prix Mpix de référence</h2>
        <p className="at-sub">Mpix ne donne pas ses prix par API : notez ici le prix affiché sur mpix.com pour le même livre.</p>
        <form className="at-form" onSubmit={saveMpix}>
          <div className="row">
            <label>Prix du livre ($ CA)<input name="book" inputMode="decimal" defaultValue={(data.mpix.bookCents / 100).toFixed(2)} /></label>
            <label>Livraison ($ CA)<input name="shipping" inputMode="decimal" defaultValue={(data.mpix.shippingCents / 100).toFixed(2)} /></label>
          </div>
          <label>Produit Mpix comparé<input name="note" maxLength={300} placeholder="ex. Livre photo rigide 8,5 × 11, 24 pages" defaultValue={data.mpix.note} /></label>
          <div className="at-actions"><button className="at-btn primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button></div>
        </form>
        {notice ? <p className={`at-notice ${notice.error ? 'error' : ''}`}>{notice.text}</p> : null}
      </article>
    </div>
  );
}
