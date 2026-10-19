'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ORDER_STATUS, dateOnly, dateTime, money, readJson } from './format';
import './admin-tools.css';

type Client = {
  id: string;
  email: string;
  display_name: string | null;
  phone: string | null;
  company_name: string | null;
  preferred_locale: string;
  country_code: string | null;
  region_code: string | null;
  postal_code: string | null;
  shipping_address: Record<string, string>;
  created_at: string;
  orderCount: number;
  paidCount: number;
  spentCents: number;
  lastOrderAt: string | null;
  projectCount: number;
};
type Detail = {
  profile: Client;
  orders: Array<{ id: string; order_number: string; status: string; total_cents: number; created_at: string; product_code: string | null }>;
  projects: Array<{ id: string; title: string; status: string; collection: string; progress: number; updated_at: string }>;
};

function csvDownload(rows: Client[]) {
  const header = ['Nom', 'Courriel', 'Téléphone', 'Entreprise', 'Langue', 'Inscription', 'Commandes payées', 'Total dépensé', 'Dernière commande'];
  const cell = (value: unknown) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[";\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const lines = rows.map((client) => [client.display_name, client.email, client.phone, client.company_name, client.preferred_locale, client.created_at.slice(0, 10), client.paidCount, (client.spentCents / 100).toFixed(2).replace('.', ','), client.lastOrderAt?.slice(0, 10)]);
  const blob = new Blob(['﻿' + [header, ...lines].map((row) => row.map(cell).join(';')).join('\r\n')], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `clients-memoire-maison-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function ClientsManager() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'spent' | 'name'>('recent');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = () =>
    fetch('/api/admin/clients')
      .then((response) => readJson<{ clients: Client[] }>(response))
      .then((value) => setClients(value.clients))
      .catch((reason: Error) => setError(reason.message));
  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = (clients || []).filter((client) =>
      !needle || [client.display_name, client.email, client.phone, client.company_name].some((value) => value?.toLowerCase().includes(needle)),
    );
    return [...list].sort((a, b) =>
      sort === 'spent' ? b.spentCents - a.spentCents : sort === 'name' ? (a.display_name || a.email).localeCompare(b.display_name || b.email, 'fr') : b.created_at.localeCompare(a.created_at),
    );
  }, [clients, query, sort]);

  if (error) return <p className="at-notice error">{error}</p>;
  const buyers = (clients || []).filter((client) => client.paidCount > 0);
  return (
    <div className="admin-module">
      <section className="at-kpis">
        <article><p>Comptes clients</p><b>{clients ? clients.length : '…'}</b><small>Tous les inscrits</small></article>
        <article><p>Clients acheteurs</p><b>{clients ? buyers.length : '…'}</b><small>Au moins une commande payée</small></article>
        <article><p>Valeur moyenne d’un acheteur</p><b>{buyers.length ? money(buyers.reduce((sum, client) => sum + client.spentCents, 0) / buyers.length) : '—'}</b><small>Total dépensé TTC</small></article>
      </section>
      <article className="at-panel">
        <div className="at-toolbar" style={{ marginBottom: 14 }}>
          <input type="search" placeholder="Rechercher un nom, un courriel, un téléphone…" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Rechercher un client" />
          <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Trier">
            <option value="recent">Plus récents</option>
            <option value="spent">Meilleurs clients</option>
            <option value="name">Nom (A → Z)</option>
          </select>
          <button className="at-btn" type="button" disabled={!visible.length} onClick={() => csvDownload(visible)}>Exporter (Excel)</button>
        </div>
        {!clients ? (
          <p className="at-empty">Chargement des clients…</p>
        ) : !visible.length ? (
          <p className="at-empty">Aucun client ne correspond.</p>
        ) : (
          <div className="at-scroll">
            <table className="at-table">
              <thead><tr><th>Client</th><th>Téléphone</th><th>Inscription</th><th className="num">Commandes</th><th className="num">Dépensé</th><th>Dernière commande</th></tr></thead>
              <tbody>
                {visible.map((client) => (
                  <tr key={client.id} className="clickable" tabIndex={0} onClick={() => setOpenId(client.id)} onKeyDown={(event) => event.key === 'Enter' && setOpenId(client.id)}>
                    <td><b>{client.display_name || '—'}</b><div className="muted">{client.email}{client.company_name ? ` · ${client.company_name}` : ''}</div></td>
                    <td>{client.phone || '—'}</td>
                    <td className="muted">{dateOnly(client.created_at)}</td>
                    <td className="num">{client.paidCount} / {client.orderCount}</td>
                    <td className="num">{money(client.spentCents)}</td>
                    <td className="muted">{dateOnly(client.lastOrderAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
      {openId ? <ClientEditor id={openId} close={() => setOpenId(null)} saved={() => void load()} /> : null}
    </div>
  );
}

function ClientEditor({ id, close, saved }: { id: string; close: () => void; saved: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(`/api/admin/clients?id=${id}`)
      .then((response) => readJson<Detail>(response))
      .then(setDetail)
      .catch((reason: Error) => setNotice({ text: reason.message, error: true }));
  }, [id]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) || '').trim();
    const nullable = (name: string) => text(name) || null;
    setBusy(true);
    setNotice(null);
    try {
      const value = await readJson<{ profile: Client }>(
        await fetch('/api/admin/clients', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            id,
            email: text('email'),
            display_name: nullable('display_name'),
            phone: nullable('phone'),
            company_name: nullable('company_name'),
            preferred_locale: text('preferred_locale'),
            country_code: nullable('country_code')?.toUpperCase() ?? null,
            region_code: nullable('region_code')?.toUpperCase() ?? null,
            postal_code: nullable('postal_code')?.toUpperCase() ?? null,
            shipping_address: { street1: text('street1'), street2: text('street2'), city: text('city') },
          }),
        }),
      );
      setDetail((current) => (current ? { ...current, profile: { ...current.profile, ...value.profile } } : current));
      setNotice({ text: 'Client enregistré. La modification est inscrite au journal.' });
      saved();
    } catch (reason) {
      setNotice({ text: (reason as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  };

  const profile = detail?.profile;
  return (
    <>
      <div className="at-drawer-backdrop" onClick={close} />
      <aside className="at-drawer" role="dialog" aria-modal="true" aria-label="Fiche client">
        <header>
          <div>
            <p className="eyebrow">Fiche client</p>
            <h2>{profile?.display_name || profile?.email || 'Chargement…'}</h2>
          </div>
          <button className="at-btn" type="button" onClick={close} aria-label="Fermer">×</button>
        </header>
        {notice ? <p className={`at-notice ${notice.error ? 'error' : ''}`}>{notice.text}</p> : null}
        {profile ? (
          <form className="at-form" onSubmit={save} key={profile.id}>
            <div className="row">
              <label>Nom<input name="display_name" defaultValue={profile.display_name || ''} /></label>
              <label>Courriel (sert aussi à la connexion)<input name="email" type="email" required defaultValue={profile.email} /></label>
            </div>
            <div className="row">
              <label>Téléphone<input name="phone" defaultValue={profile.phone || ''} /></label>
              <label>Entreprise<input name="company_name" defaultValue={profile.company_name || ''} /></label>
            </div>
            <label>Adresse<input name="street1" defaultValue={profile.shipping_address?.street1 || ''} /></label>
            <label>Complément<input name="street2" defaultValue={profile.shipping_address?.street2 || ''} /></label>
            <div className="row">
              <label>Ville<input name="city" defaultValue={profile.shipping_address?.city || ''} /></label>
              <label>Code postal<input name="postal_code" defaultValue={profile.postal_code || ''} /></label>
            </div>
            <div className="row">
              <label>Province (ex. QC)<input name="region_code" maxLength={10} defaultValue={profile.region_code || ''} /></label>
              <label>Pays (ex. CA)<input name="country_code" maxLength={2} defaultValue={profile.country_code || ''} /></label>
            </div>
            <label>Langue<select name="preferred_locale" defaultValue={profile.preferred_locale}><option value="fr">Français</option><option value="en">Anglais</option></select></label>
            <div className="at-actions"><button className="at-btn primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button><span className="hint">Inscrit le {dateOnly(profile.created_at)}</span></div>
          </form>
        ) : null}
        {detail ? (
          <>
            <h3 style={{ font: '17px Georgia, serif', margin: '26px 0 8px' }}>Commandes ({detail.orders.length})</h3>
            {detail.orders.length ? (
              <table className="at-table"><tbody>{detail.orders.map((order) => (
                <tr key={order.id}><td>{order.order_number}<div className="muted">{dateTime(order.created_at)}</div></td><td><span className={`at-pill ${ORDER_STATUS[order.status]?.tone || ''}`}>{ORDER_STATUS[order.status]?.label || order.status}</span></td><td className="num">{money(order.total_cents)}</td></tr>
              ))}</tbody></table>
            ) : <p className="at-empty">Aucune commande.</p>}
            <h3 style={{ font: '17px Georgia, serif', margin: '22px 0 8px' }}>Projets de livre ({detail.projects.length})</h3>
            {detail.projects.length ? (
              <table className="at-table"><tbody>{detail.projects.map((project) => (
                <tr key={project.id}><td>{project.title}<div className="muted">{project.collection}</div></td><td>{project.status}</td><td className="num">{project.progress} %</td></tr>
              ))}</tbody></table>
            ) : <p className="at-empty">Aucun projet.</p>}
          </>
        ) : null}
      </aside>
    </>
  );
}
