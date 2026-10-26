'use client';

import { useEffect, useMemo, useState } from 'react';
import { dateTime, readJson } from './format';
import './admin-tools.css';

type Logs = {
  audit: Array<{ id: string; action: string; entity_type: string; entity_id: string | null; details: Record<string, unknown>; created_at: string }>;
  payments: Array<{ id: string; type: string; livemode: boolean; processed_at: string }>;
  emails: Array<{ id: string; user_email: string; template: string; subject: string; status: string; attempts: number; last_error: string | null; created_at: string; sent_at: string | null }>;
  visits: Array<{ visitor_id: string; event_name: string; path: string; metadata: Record<string, unknown> | null; created_at: string }>;
};

const ACTIONS: Record<string, string> = {
  'client.update': 'Client modifié',
  'order.update': 'Commande modifiée',
  'seo.update': 'Référencement modifié',
  'accounting.expense': 'Dépense ajoutée',
  'accounting.sale': 'Vente manuelle ajoutée',
  'accounting.entry': 'Écriture comptable ajoutée',
  'accounting.void': 'Écriture annulée',
  'accounting.export': 'Comptabilité téléchargée',
  'admin.grant': 'Accès admin donné',
  'admin.revoke': 'Accès admin retiré',
};

const TABS = [
  ['audit', 'Actions admin'],
  ['payments', 'Paiements Stripe'],
  ['emails', 'Courriels envoyés'],
  ['visits', 'Visites en direct'],
] as const;

/** Journal: every admin change, payment notification, email and visit. */
export function LogsViewer() {
  const [logs, setLogs] = useState<Logs | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('audit');
  const [query, setQuery] = useState('');
  const load = () =>
    fetch('/api/admin/logs?limit=300')
      .then((response) => readJson<Logs>(response))
      .then(setLogs)
      .catch((reason: Error) => setError(reason.message));
  useEffect(() => {
    void load();
  }, []);

  const audit = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (logs?.audit || []).filter((item) => !needle || JSON.stringify(item).toLowerCase().includes(needle));
  }, [logs, query]);

  if (error) return <p className="at-notice error">{error}</p>;
  return (
    <div className="admin-module">
      <div className="at-toolbar">
        <div className="at-seg" role="tablist" aria-label="Type de journal">
          {TABS.map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>
              {label}
            </button>
          ))}
        </div>
        {tab === 'audit' ? <input type="search" placeholder="Filtrer (courriel, commande, action…)" value={query} onChange={(event) => setQuery(event.target.value)} /> : null}
        <button className="at-btn" type="button" onClick={() => void load()}>Actualiser</button>
      </div>
      <article className="at-panel">
        {!logs ? (
          <p className="at-empty">Chargement du journal…</p>
        ) : tab === 'audit' ? (
          audit.length ? (
            <div className="at-log">
              {audit.map((item) => (
                <details key={item.id}>
                  <summary>
                    <span className="muted">{dateTime(item.created_at)}</span>
                    <b>{ACTIONS[item.action] || item.action}</b>
                    <span>{String(item.details?.actor_email || '')} · {item.entity_type}{item.entity_id ? ` ${String(item.details?.order_number || item.details?.email || item.details?.reference || item.entity_id)}` : ''}</span>
                  </summary>
                  <pre>{JSON.stringify(item.details, null, 2)}</pre>
                </details>
              ))}
            </div>
          ) : (
            <p className="at-empty">Aucune action enregistrée pour l’instant. Chaque modification faite dans l’admin apparaîtra ici.</p>
          )
        ) : tab === 'payments' ? (
          logs.payments.length ? (
            <table className="at-table"><thead><tr><th>Reçu le</th><th>Événement Stripe</th><th>Mode</th></tr></thead><tbody>
              {logs.payments.map((item) => <tr key={item.id}><td className="muted">{dateTime(item.processed_at)}</td><td>{item.type}</td><td>{item.livemode ? <span className="at-pill good">Réel</span> : <span className="at-pill warn">Test</span>}</td></tr>)}
            </tbody></table>
          ) : <p className="at-empty">Aucune notification de paiement reçue.</p>
        ) : tab === 'emails' ? (
          logs.emails.length ? (
            <div className="at-scroll"><table className="at-table"><thead><tr><th>Créé le</th><th>Destinataire</th><th>Objet</th><th>Statut</th></tr></thead><tbody>
              {logs.emails.map((item) => <tr key={item.id}><td className="muted">{dateTime(item.created_at)}</td><td>{item.user_email}</td><td>{item.subject}{item.last_error ? <div className="muted">{item.last_error}</div> : null}</td><td><span className={`at-pill ${item.status === 'sent' ? 'good' : item.status === 'failed' ? 'bad' : 'warn'}`}>{item.status === 'sent' ? 'Envoyé' : item.status === 'failed' ? 'Échec' : item.status === 'queued' ? 'En file' : 'Annulé'}</span></td></tr>)}
            </tbody></table></div>
          ) : <p className="at-empty">Aucun courriel envoyé.</p>
        ) : logs.visits.length ? (
          <div className="at-scroll"><table className="at-table"><thead><tr><th>Quand</th><th>Page</th><th>Provenance</th><th>Appareil</th><th>Lieu</th></tr></thead><tbody>
            {logs.visits.map((item, index) => <tr key={`${item.visitor_id}-${item.created_at}-${index}`}><td className="muted">{dateTime(item.created_at)}</td><td>{item.path}</td><td>{String(item.metadata?.referrer || 'Accès direct')}</td><td>{String(item.metadata?.device || '—')}</td><td>{[item.metadata?.country, item.metadata?.region].filter(Boolean).join(' · ') || '—'}</td></tr>)}
          </tbody></table></div>
        ) : <p className="at-empty">Aucune visite enregistrée pour l’instant.</p>}
      </article>
    </div>
  );
}
