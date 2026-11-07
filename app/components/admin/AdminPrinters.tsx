'use client';

import { useEffect, useState } from 'react';
import { money, readJson } from './format';
import './admin-tools.css';

type Usage = { projects: number; orders: number; revenueCents: number };
type Payload = {
  prodigi: { configured: boolean; environment: string; ordersEnabled: boolean; sku: string; description?: string; printAreas?: string[]; bookCost?: string; shippingCost?: string; currency?: string; error?: string };
  usage: { prodigi: Usage };
};

const amountToCents = (value?: string) => (value ? Math.round(Number(value) * 100) : null);

export function PrinterComparison() {
  const [data, setData] = useState<Payload | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/admin/printers')
      .then((response) => readJson<Payload>(response))
      .then(setData)
      .catch((reason: Error) => setNotice({ text: reason.message, error: true }));
  }, []);

  if (!data) return notice ? <p className="at-notice error">{notice.text}</p> : <article className="at-panel"><p className="at-empty">Chargement des données d’impression…</p></article>;

  const prodigiBook = amountToCents(data.prodigi.bookCost);
  const prodigiShipping = amountToCents(data.prodigi.shippingCost);
  const prodigiTotal = prodigiBook !== null ? prodigiBook + (prodigiShipping || 0) : null;
  const prodigiState = !data.prodigi.configured
    ? 'Clé API à ajouter (PRODIGI_API_KEY)'
    : data.prodigi.error
      ? `Erreur : ${data.prodigi.error}`
      : `Connecté · ${data.prodigi.environment === 'live' ? 'réel' : 'mode test'}${data.prodigi.ordersEnabled ? ' · envoi activé' : ' · envoi verrouillé'}`;

  return (
    <div className="admin-module">
      <article className="at-panel">
        <h2>Impression · Prodigi</h2>
        <p className="at-sub">Estimation pour un livre de 24 pages livré au Canada, dans la devise du fournisseur. Les taxes finales dépendent de l’adresse.</p>
        <div className="at-scroll">
          <table className="at-table">
            <thead>
              <tr><th></th><th>Prodigi</th></tr>
            </thead>
            <tbody>
              <tr><td>Connexion</td><td>{prodigiState}</td></tr>
              <tr><td>Livre</td><td>{prodigiBook !== null ? `${data.prodigi.bookCost} ${data.prodigi.currency}` : '—'}</td></tr>
              <tr><td>Livraison</td><td>{prodigiShipping !== null ? `${data.prodigi.shippingCost} ${data.prodigi.currency}` : '—'}</td></tr>
              <tr><td><b>Total</b></td><td><b>{prodigiTotal !== null ? `${(prodigiTotal/100).toFixed(2)} ${data.prodigi.currency}` : '—'}</b></td></tr>
              <tr><td>Produit</td><td>{data.prodigi.description || data.prodigi.sku}</td></tr>
              <tr><td>Livres créés</td><td>{data.usage.prodigi.projects}</td></tr>
              <tr><td>Commandes payées</td><td>{data.usage.prodigi.orders}</td></tr>
              <tr><td>Chiffre d’affaires</td><td>{money(data.usage.prodigi.revenueCents)}</td></tr>
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
