'use client';

import { useState } from 'react';
import Link from './SafeLink';
import { BookCustomizer } from './BookCustomizer';
import type { BookLocale } from '../../lib/book';
import './provider-studio.css';

type Quote = { method: string; items: { amount: string; currency: string }; shipping: { amount: string; currency: string }; tax?: { amount: string; currency: string }; total?: { amount: string; currency: string } };

export function ProviderStudio({ provider, locale = 'fr' }: { provider: 'mpix' | 'prodigi'; locale?: BookLocale }) {
  const en = locale === 'en';
  const [creating, setCreating] = useState(false);
  const [country, setCountry] = useState('CA');
  const [copies, setCopies] = useState(1);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const name = provider === 'mpix' ? 'Mpix' : 'Prodigi';
  const tr = (fr: string, english: string) => en ? english : fr;
  async function quote() {
    setBusy(true); setNotice(''); setQuotes([]); setIssues([]);
    try {
      const response = await fetch('/api/admin/print/prodigi/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ country, copies, pageCount: 24 }) });
      const result = await response.json() as { error?: string; quotes: Quote[]; issues?: string[] };
      if (!response.ok) throw new Error(result.error || tr('Devis indisponible.', 'Quote unavailable.'));
      setQuotes(result.quotes); setIssues(result.issues || []);
      setNotice(tr('Devis reçu de Prodigi. Aucun livre envoyé en fabrication.', 'Quote received from Prodigi. No book submitted for printing.'));
    } catch (error) { setNotice(error instanceof Error ? error.message : tr('Connexion impossible.', 'Connection failed.')); }
    finally { setBusy(false); }
  }
  if (creating) return <><div className="provider-return"><button onClick={() => setCreating(false)}>← {tr('Comparaison des fournisseurs', 'Compare providers')}</button><span>{name}</span></div><BookCustomizer key={`${provider}-${locale}`} provider={provider} locale={locale}/></>;
  const prefix = en ? '/en' : '';
  return <main className="provider-page">
    <header><Link href="/admin">← {tr('Administration', 'Administration')}</Link><img src="/memoire-maison-logo.png" alt="Mémoire Maison"/><Link href={`${prefix}/creation/${provider === 'mpix' ? 'prodigi' : 'mpix'}`}>{tr('Comparer avec', 'Compare with')} {provider === 'mpix' ? 'Prodigi' : 'Mpix'} →</Link></header>
    <section className="provider-hero"><div><p className="eyebrow">{tr('L’atelier des belles histoires', 'The studio for beautiful stories')}</p><h1>{tr('Votre livre,', 'Your book,')}<br/><em>{tr('édition', 'the')} {name}{en ? ' edition' : ''}.</em></h1><p>{tr('Créez votre histoire, ajoutez vos photos et feuilletez votre livre. Comparez ensuite les finitions et les coûts avant de choisir votre imprimeur.', 'Create your story, add your photos and flip through your book. Compare finishes and costs before choosing your printer.')}</p><button className="button" onClick={() => setCreating(true)}>{tr('Créer mon livre', 'Create my book')} <span aria-hidden="true">↗︎</span></button><small>{tr('Brouillon distinct par fournisseur · aperçu modifiable · aucune impression automatique', 'Separate draft for each provider · editable preview · no automatic printing')}</small></div><div className="provider-visual"><img src={provider === 'mpix' ? '/book-famille.webp' : '/book-essentiel.webp'} onError={(event) => { event.currentTarget.src = '/memoire-maison-logo.png'; }} alt={tr('Inspiration de livre Mémoire Maison', 'Mémoire Maison book inspiration')}/><span>{tr('Visuel d’inspiration · finition à confirmer', 'Inspiration image · finish subject to confirmation')}</span></div></section>
    <section className="provider-detail-grid"><article><p className="eyebrow">01 · {tr('La finition', 'The finish')}</p><h2>{provider === 'mpix' ? tr('Toile et marquage.', 'Linen and debossing.') : tr('Couverture rigide imprimée.', 'Printed hardcover.')}</h2><p>{provider === 'mpix' ? tr('La gamme Premium Hardcover propose une couverture en toile et du texte débossé. Le logo personnalisé en creux doit être confirmé par Mpix.', 'Premium Hardcover offers linen covers and debossed text. Custom blind-debossed logos must be confirmed by Mpix.') : tr('Livre photo à reliure PUR, couverture personnalisée imprimée et pelliculée. Le devis de référence porte sur le format A4 portrait, 24 pages.', 'PUR-bound photo book with a custom printed laminated cover. The reference quote is for A4 portrait, 24 pages.')}</p><p className="provider-note">{tr('L’aperçu sert à composer le livre. Les fichiers d’impression et leurs dimensions doivent encore être validés pour ce fournisseur.', 'The preview is for composing your book. Print files and dimensions still require validation for this provider.')}</p></article>
    <article><p className="eyebrow">02 · {tr('Connexion et tarif', 'Connection and price')}</p><h2>{provider === 'mpix' ? tr('Accès partenaire requis.', 'Partner access required.') : tr('Un devis à l’unité.', 'A quote for one copy.')}</h2>{provider === 'mpix' ? <><p>{tr('Le compte client Mpix ne fournit pas encore les identifiants de l’API partenaire. La création et l’aperçu sont disponibles ici ; la fabrication reste en attente de cet accès.', 'The Mpix customer account does not yet provide partner API credentials. Creation and preview are available here; production is pending partner access.')}</p><div className="provider-price">82,99 $ <small>USD</small></div><p>{tr('Repère catalogue : 8 × 8 po, 24 pages, toile et débossage texte. Hors livraison et taxes ; tarif partenaire non confirmé.', 'Catalog reference: 8 × 8 in, 24 pages, linen and text debossing. Shipping and tax excluded; partner pricing unconfirmed.')}</p><a href="https://www.mpix.com/photo-books/premium-hardcover" target="_blank" rel="noreferrer">{tr('Voir la fiche fournisseur', 'View supplier product')} ↗︎</a></> : <><p>{tr('Le devis interroge Prodigi pour 24 pages. Ce coût fournisseur ne constitue pas le prix de vente du site.', 'The quote queries Prodigi for 24 pages. This supplier cost is not the store selling price.')}</p><div className="provider-fields"><label>{tr('Destination', 'Destination')}<select value={country} onChange={(e) => { setCountry(e.target.value); setQuotes([]); setNotice(''); }}><option value="CA">Canada</option><option value="US">USA</option><option value="FR">France</option></select></label><label>{tr('Exemplaires', 'Copies')}<select value={copies} onChange={(e) => { setCopies(Number(e.target.value)); setQuotes([]); setNotice(''); }}><option value={1}>1</option><option value={2}>2 · {tr('Famille', 'Family')}</option></select></label></div><button className="button" disabled={busy} onClick={() => void quote()}>{busy ? tr('Calcul…', 'Calculating…') : tr('Obtenir le devis réel', 'Get a live quote')}</button><p role="status">{notice}</p>{quotes.map((q, i) => <div className="provider-quote" key={i}><b>{q.method}</b><p>{tr('Impression', 'Printing')} : {q.items.amount} {q.items.currency}</p><p>{tr('Livraison', 'Shipping')} : {q.shipping.amount} {q.shipping.currency}</p>{q.tax && <p>{tr('Taxes fournisseur', 'Supplier taxes')} : {q.tax.amount} {q.tax.currency}</p>}{q.total && <strong>{tr('Total fournisseur', 'Supplier total')} : {q.total.amount} {q.total.currency}</strong>}</div>)}{issues.map((issue, index) => <p className="provider-note" key={index}>{issue}</p>)}<small>{tr('Les taxes finales dépendent de l’adresse exacte. Aucun paiement ni commande n’est créé.', 'Final taxes depend on the exact address. No payment or order is created.')}</small></>}</article></section>
  </main>;
}
