'use client';

import { useEffect, useState } from 'react';
import { BarSeries, HBars } from './AdminCharts';
import { ORDER_STATUS, dateTime, money, moneyShort, readJson } from './format';
import './admin-tools.css';

type Stats = {
  days: number;
  sales: {
    revenueCents: number;
    taxCents: number;
    refundCents: number;
    costCents: number;
    paidOrders: number;
    allOrders: number;
    averageCents: number;
    byStatus: Array<{ label: string; value: number }>;
    byProduct: Array<{ label: string; orders: number; revenueCents: number }>;
    recent: Array<{ id: string; order_number: string; status: string; total_cents: number; customer_email: string | null; created_at: string; product_code: string | null }>;
  };
  visits: {
    sessions: number;
    pageViews: number;
    pagesPerSession: number;
    conversion: number;
    topPages: Array<{ label: string; value: number }>;
    referrers: Array<{ label: string; value: number }>;
    devices: Array<{ label: string; value: number }>;
    countries: Array<{ label: string; value: number }>;
    campaigns: Array<{ label: string; value: number }>;
    languages: Array<{ label: string; value: number }>;
    funnel: Array<{ label: string; value: number }>;
  };
  series: Array<{ date: string; revenueCents: number; orders: number; visits: number; pageViews: number }>;
};

const PERIODS = [
  [7, '7 jours'],
  [30, '30 jours'],
  [90, '90 jours'],
  [365, '12 mois'],
] as const;

function useStats() {
  const [days, setDays] = useState<number>(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    fetch(`/api/admin/stats?days=${days}`)
      .then((response) => readJson<Stats>(response))
      .then((value) => {
        if (!active) return;
        setStats(value);
        setError('');
      })
      .catch((reason: Error) => active && setError(reason.message));
    return () => {
      active = false;
    };
  }, [days]);
  return { days, setDays, stats, error };
}

function Period({ days, setDays }: { days: number; setDays: (value: number) => void }) {
  return (
    <div className="at-seg" role="group" aria-label="Période">
      {PERIODS.map(([value, label]) => (
        <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)}>
          {label}
        </button>
      ))}
    </div>
  );
}

const count = (value: number) => new Intl.NumberFormat('fr-CA').format(Math.round(value));

function Funnel({ steps }: { steps: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, steps[0]?.value || 0);
  return (
    <div className="at-funnel">
      {steps.map((step) => (
        <div key={step.label}>
          <span>{step.label}</span>
          <i style={{ width: `${(step.value / max) * 100}%` }} />
          <b>{count(step.value)}</b>
        </div>
      ))}
    </div>
  );
}

/** Vue d'ensemble: money first, then visits, then what needs attention. */
export function LiveStats({ open }: { open: (section: string) => void }) {
  const { days, setDays, stats, error } = useStats();
  if (error) return <p className="at-notice error">{error}</p>;
  return (
    <div className="admin-module">
      <div className="at-toolbar">
        <Period days={days} setDays={setDays} />
        <span className="at-empty">Données réelles uniquement · fuseau de Montréal</span>
      </div>
      {!stats ? (
        <article className="at-panel"><p className="at-empty">Chargement des statistiques…</p></article>
      ) : (
        <>
          <section className="at-kpis">
            <article><p>Ventes hors taxes</p><b>{moneyShort(stats.sales.revenueCents)}</b><small>{stats.sales.paidOrders} commandes payées</small></article>
            <article><p>Panier moyen</p><b>{moneyShort(stats.sales.averageCents)}</b><small>Hors taxes</small></article>
            <article><p>Visites</p><b>{count(stats.visits.sessions)}</b><small>{count(stats.visits.pageViews)} pages vues</small></article>
            <article><p>Taux de conversion</p><b>{stats.visits.conversion.toLocaleString('fr-CA')} %</b><small>Commandes payées ÷ visites</small></article>
            <article><p>Taxes perçues</p><b>{moneyShort(stats.sales.taxCents)}</b><small>À remettre (TPS/TVQ)</small></article>
            <article><p>Coûts des commandes</p><b>{moneyShort(stats.sales.costCents)}</b><small>Impression et frais de paiement</small></article>
          </section>
          <div className="at-grid">
            <article className="at-panel">
              <h2>Ventes par jour</h2>
              <p className="at-sub">Hors taxes, après remboursements</p>
              <BarSeries title="Ventes par jour" points={stats.series.map((item) => ({ label: item.date, value: item.revenueCents, tip: `${item.date} · ${item.orders} commande(s)` }))} format={moneyShort} />
            </article>
            <article className="at-panel">
              <h2>Visites par jour</h2>
              <p className="at-sub">Une visite = une session de navigation</p>
              <BarSeries title="Visites par jour" points={stats.series.map((item) => ({ label: item.date, value: item.visits, tip: `${item.date} · ${item.pageViews} pages vues` }))} format={count} />
            </article>
          </div>
          <div className="at-grid three">
            <article className="at-panel">
              <h2>Parcours d’achat</h2>
              <p className="at-sub">Combien de visites vont jusqu’au paiement</p>
              <Funnel steps={stats.visits.funnel} />
            </article>
            <article className="at-panel">
              <h2>Ventes par offre</h2>
              <p className="at-sub">Chiffre d’affaires hors taxes</p>
              <HBars items={stats.sales.byProduct.map((item) => ({ label: `${item.label} · ${item.orders} cmd`, value: item.revenueCents }))} format={moneyShort} />
            </article>
            <article className="at-panel">
              <h2>Commandes par statut</h2>
              <p className="at-sub">Toutes les commandes de la période</p>
              <HBars items={stats.sales.byStatus.map((item) => ({ label: ORDER_STATUS[item.label]?.label || item.label, value: item.value }))} format={count} />
            </article>
          </div>
          <article className="at-panel">
            <div className="at-actions" style={{ justifyContent: 'space-between' }}>
              <h2>Dernières commandes</h2>
              <button className="at-btn" type="button" onClick={() => open('Commandes')}>Toutes les commandes →</button>
            </div>
            <RecentOrders orders={stats.sales.recent} />
          </article>
        </>
      )}
    </div>
  );
}

function RecentOrders({ orders }: { orders: Stats['sales']['recent'] }) {
  if (!orders.length) return <p className="at-empty">Aucune commande sur cette période.</p>;
  return (
    <div className="at-scroll">
      <table className="at-table">
        <thead><tr><th>Commande</th><th>Date</th><th>Client</th><th>Offre</th><th>Statut</th><th className="num">Total</th></tr></thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>{order.order_number}</td>
              <td className="muted">{dateTime(order.created_at)}</td>
              <td>{order.customer_email || '—'}</td>
              <td>{order.product_code || '—'}</td>
              <td><span className={`at-pill ${ORDER_STATUS[order.status]?.tone || ''}`}>{ORDER_STATUS[order.status]?.label || order.status}</span></td>
              <td className="num">{money(order.total_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Visites & analytics: traffic, pages, sources, devices, places, campaigns. */
export function LiveVisits() {
  const { days, setDays, stats, error } = useStats();
  if (error) return <p className="at-notice error">{error}</p>;
  return (
    <div className="admin-module">
      <div className="at-toolbar">
        <Period days={days} setDays={setDays} />
        <span className="at-empty">Visites anonymes (sans cookie de suivi) · robots exclus · pages admin exclues</span>
      </div>
      {!stats ? (
        <article className="at-panel"><p className="at-empty">Chargement des visites…</p></article>
      ) : (
        <>
          <section className="at-kpis">
            <article><p>Visites</p><b>{count(stats.visits.sessions)}</b><small>Sessions de navigation</small></article>
            <article><p>Pages vues</p><b>{count(stats.visits.pageViews)}</b><small>{stats.visits.pagesPerSession.toLocaleString('fr-CA')} pages par visite</small></article>
            <article><p>Conversion</p><b>{stats.visits.conversion.toLocaleString('fr-CA')} %</b><small>{stats.sales.paidOrders} commandes payées</small></article>
          </section>
          <article className="at-panel">
            <h2>Visites par jour</h2>
            <p className="at-sub">Sessions de navigation, jour par jour</p>
            <BarSeries title="Visites par jour" points={stats.series.map((item) => ({ label: item.date, value: item.visits, tip: `${item.date} · ${item.pageViews} pages vues` }))} format={count} />
          </article>
          <div className="at-grid">
            <article className="at-panel"><h2>Pages les plus vues</h2><p className="at-sub">Nombre de vues</p><HBars items={stats.visits.topPages} format={count} /></article>
            <article className="at-panel"><h2>D’où viennent les visiteurs</h2><p className="at-sub">Site précédent (Google, Facebook…)</p><HBars items={stats.visits.referrers} format={count} /></article>
          </div>
          <div className="at-grid three">
            <article className="at-panel"><h2>Appareils</h2><p className="at-sub">Pages vues</p><HBars items={stats.visits.devices} format={count} /></article>
            <article className="at-panel"><h2>Pays et régions</h2><p className="at-sub">Pages vues</p><HBars items={stats.visits.countries} format={count} /></article>
            <article className="at-panel"><h2>Langue</h2><p className="at-sub">Pages vues</p><HBars items={stats.visits.languages} format={count} /></article>
          </div>
          <div className="at-grid">
            <article className="at-panel"><h2>Campagnes</h2><p className="at-sub">Liens avec utm_campaign ou utm_source</p><HBars items={stats.visits.campaigns} format={count} empty="Aucune campagne suivie. Ajoutez ?utm_source=facebook à vos liens publicitaires." /></article>
            <article className="at-panel"><h2>Parcours d’achat</h2><p className="at-sub">De la visite au paiement</p><Funnel steps={stats.visits.funnel} /></article>
          </div>
        </>
      )}
    </div>
  );
}
