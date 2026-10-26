'use client';

import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { ORDER_STATUS, dateTime, money, readJson } from './format';
import './admin-tools.css';

type Order = {
  id: string;
  order_number: string;
  status: string;
  product_code: string | null;
  quantity: number;
  total_cents: number;
  subtotal_cents: number;
  shipping_cents: number;
  tax_cents: number;
  refund_cents: number;
  provider_cost_cents: number;
  payment_fee_cents: number;
  customer_email: string | null;
  tracking_url: string | null;
  invoice_number: string | null;
  lulu_status: string | null;
  payment_status: string | null;
  created_at: string;
  paid_at: string | null;
};

const toCents = (value: FormDataEntryValue | null) => Math.round(Number(String(value || '0').replace(',', '.')) * 100);
const toDollars = (cents: number) => (cents / 100).toFixed(2);

/** Every sale, its follow-up and its money: status, tracking, real costs, refunds. */
export function OrdersManager({ printActions }: { printActions: (orderId: string) => ReactNode }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = () =>
    fetch('/api/admin/operations')
      .then((response) => readJson<{ orders: Order[] }>(response))
      .then((value) => setOrders(value.orders))
      .catch((reason: Error) => setError(reason.message));
  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (orders || []).filter(
      (order) =>
        (status === 'all' || order.status === status) &&
        (!needle || [order.order_number, order.customer_email, order.product_code, order.invoice_number].some((value) => value?.toLowerCase().includes(needle))),
    );
  }, [orders, query, status]);

  if (error) return <p className="at-notice error">{error}</p>;
  const toShip = (orders || []).filter((order) => ['paid', 'preflight', 'printing'].includes(order.status)).length;
  const open = orders?.find((order) => order.id === openId) || null;
  return (
    <div className="admin-module">
      <section className="at-kpis">
        <article><p>Commandes</p><b>{orders ? orders.length : '…'}</b><small>Toutes périodes</small></article>
        <article><p>À produire ou expédier</p><b>{orders ? toShip : '…'}</b><small>Payées, pas encore expédiées</small></article>
        <article><p>En attente de paiement</p><b>{orders ? orders.filter((order) => ['pending', 'awaiting_payment'].includes(order.status)).length : '…'}</b><small>Paniers non payés</small></article>
      </section>
      <article className="at-panel">
        <div className="at-toolbar" style={{ marginBottom: 14 }}>
          <input type="search" placeholder="Numéro, courriel, facture…" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Rechercher une commande" />
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrer par statut">
            <option value="all">Tous les statuts</option>
            {Object.entries(ORDER_STATUS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
          </select>
        </div>
        {!orders ? (
          <p className="at-empty">Chargement des commandes…</p>
        ) : !visible.length ? (
          <p className="at-empty">Aucune commande ne correspond.</p>
        ) : (
          <div className="at-scroll">
            <table className="at-table">
              <thead><tr><th>Commande</th><th>Client</th><th>Offre</th><th>Statut</th><th className="num">Total TTC</th><th className="num">Marge</th></tr></thead>
              <tbody>
                {visible.map((order) => (
                  <tr key={order.id} className="clickable" tabIndex={0} onClick={() => setOpenId(order.id)} onKeyDown={(event) => event.key === 'Enter' && setOpenId(order.id)}>
                    <td><b>{order.order_number}</b><div className="muted">{dateTime(order.created_at)}</div></td>
                    <td>{order.customer_email || '—'}</td>
                    <td>{order.product_code || '—'}{order.quantity > 1 ? ` × ${order.quantity}` : ''}</td>
                    <td><span className={`at-pill ${ORDER_STATUS[order.status]?.tone || ''}`}>{ORDER_STATUS[order.status]?.label || order.status}</span></td>
                    <td className="num">{money(order.total_cents)}</td>
                    <td className="num">{money(order.subtotal_cents + order.shipping_cents - order.refund_cents - order.provider_cost_cents - order.payment_fee_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
      {open ? <OrderEditor order={open} close={() => setOpenId(null)} saved={(next) => setOrders((list) => (list || []).map((item) => (item.id === next.id ? { ...item, ...next } : item)))} printActions={printActions} /> : null}
    </div>
  );
}

function OrderEditor({ order, close, saved, printActions }: { order: Order; close: () => void; saved: (order: Order) => void; printActions: (orderId: string) => ReactNode }) {
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setNotice(null);
    try {
      const tracking = String(form.get('tracking_url') || '').trim();
      const value = await readJson<{ order: Order }>(
        await fetch(`/api/admin/orders/${order.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            status: form.get('status'),
            tracking_url: tracking || null,
            customer_email: String(form.get('customer_email') || '').trim() || undefined,
            provider_cost_cents: toCents(form.get('provider_cost')),
            payment_fee_cents: toCents(form.get('payment_fee')),
            refund_cents: toCents(form.get('refund')),
          }),
        }),
      );
      saved(value.order);
      setNotice({ text: 'Commande mise à jour. La modification est inscrite au journal.' });
    } catch (reason) {
      setNotice({ text: (reason as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="at-drawer-backdrop" onClick={close} />
      <aside className="at-drawer" role="dialog" aria-modal="true" aria-label={`Commande ${order.order_number}`}>
        <header>
          <div>
            <p className="eyebrow">Suivi de commande</p>
            <h2>{order.order_number}</h2>
            <small className="hint">Passée le {dateTime(order.created_at)}{order.paid_at ? ` · payée le ${dateTime(order.paid_at)}` : ''}</small>
          </div>
          <button className="at-btn" type="button" onClick={close} aria-label="Fermer">×</button>
        </header>
        <table className="at-table" style={{ marginBottom: 18 }}>
          <tbody>
            <tr><td>Sous-total</td><td className="num">{money(order.subtotal_cents)}</td></tr>
            <tr><td>Livraison</td><td className="num">{money(order.shipping_cents)}</td></tr>
            <tr><td>Taxes</td><td className="num">{money(order.tax_cents)}</td></tr>
            <tr><td><b>Total payé</b></td><td className="num"><b>{money(order.total_cents)}</b></td></tr>
          </tbody>
        </table>
        {notice ? <p className={`at-notice ${notice.error ? 'error' : ''}`}>{notice.text}</p> : null}
        <form className="at-form" onSubmit={save}>
          <div className="row">
            <label>Statut<select name="status" defaultValue={order.status}>{Object.entries(ORDER_STATUS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></label>
            <label>Courriel du client<input name="customer_email" type="email" defaultValue={order.customer_email || ''} /></label>
          </div>
          <label>Lien de suivi du colis<input name="tracking_url" type="url" placeholder="https://…" defaultValue={order.tracking_url || ''} /></label>
          <div className="row">
            <label>Coût d’impression réel ($)<input name="provider_cost" inputMode="decimal" defaultValue={toDollars(order.provider_cost_cents)} /></label>
            <label>Frais de paiement Stripe ($)<input name="payment_fee" inputMode="decimal" defaultValue={toDollars(order.payment_fee_cents)} /></label>
          </div>
          <label>Montant remboursé ($)<input name="refund" inputMode="decimal" defaultValue={toDollars(order.refund_cents)} /></label>
          <div className="at-actions">
            <button className="at-btn primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
            {order.invoice_number ? <a className="at-btn" href={`/admin/factures/${order.id}`} target="_blank" rel="noreferrer">Facture {order.invoice_number}</a> : null}
          </div>
          <p className="hint">Le remboursement réel se fait dans Stripe ; indiquez ici le montant pour que la comptabilité soit juste.</p>
        </form>
        <h3 style={{ font: '17px Georgia, serif', margin: '24px 0 8px' }}>Impression (Mpix ou Prodigi)</h3>
        {printActions(order.id)}
      </aside>
    </>
  );
}
