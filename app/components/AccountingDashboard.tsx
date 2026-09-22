"use client";
import { FormEvent, useEffect, useState } from "react";
import { formatCad } from "../../lib/catalog";
type Report = {
  year: number;
  orders: Array<{
    id: string;
    order_number: string;
    status: string;
    total_cents: number;
    tax_cents: number;
    provider_cost_cents: number;
    created_at: string;
    customer_email: string;
  }>;
  entries: Array<{
    id: string;
    entry_date: string;
    reference: string;
    description: string;
    status: string;
  }>;
  accounts: Array<{ code: string; name: string; account_type: string }>;
  metrics: {
    revenueCents: number;
    taxPayableCents: number;
    providerCostCents: number;
    paymentFeeCents: number;
    grossMarginCents: number;
    orderCount: number;
  };
  balances: Record<string, number>;
};
export function AccountingDashboard() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState<Report | null>(null);
  const [notice, setNotice] = useState("");
  const load = () =>
    fetch(`/api/admin/accounting?year=${year}`)
      .then((response) => (response.ok ? response.json() as Promise<Report> : null))
      .then(setReport)
      .catch(() => setReport(null));
  useEffect(() => {
    void load();
  }, [year]);
  const addExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Math.round(Number(form.get("amount")) * 100);
    const reference = String(form.get("reference"));
    const description = String(form.get("description"));
    const entryDate = String(form.get("entryDate"));
    const response = await fetch("/api/admin/accounting", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entryDate,
        reference,
        description,
        source: "supplier",
        lines: [
          {
            accountCode: "6000",
            debitCents: amount,
            creditCents: 0,
            memo: description,
          },
          {
            accountCode: "1000",
            debitCents: 0,
            creditCents: amount,
            memo: "Paiement",
          },
        ],
      }),
    });
    setNotice(
      response.ok
        ? "Dépense enregistrée dans le grand livre."
        : ((await response.json()) as {error?:string}).error || 'Écriture refusée.',
    );
    if (response.ok) {
      event.currentTarget.reset();
      load();
    }
  };
  if (!report)
    return (
      <div className="admin-module">
        <article className="panel">
          <h2>Chargement des données comptables…</h2>
        </article>
      </div>
    );
  const margin = report.metrics.revenueCents
    ? Math.round(
        (report.metrics.grossMarginCents / report.metrics.revenueCents) * 100,
      )
    : 0;
  return (
    <div className="admin-module accounting-module">
      <div className="accounting-toolbar">
        <label>
          Exercice
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          >
            {[2026, 2027, 2028].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <button onClick={() => window.print()}>Imprimer le bilan</button>
        <a href={`/api/admin/accounting?year=${year}`} download>
          Télécharger les données
        </a>
      </div>
      <div className="metric-grid">
        <article>
          <p>Ventes comptabilisées</p>
          <b>{formatCad(report.metrics.revenueCents)}</b>
          <small>{report.metrics.orderCount} commandes payées</small>
        </article>
        <article>
          <p>Taxes à remettre</p>
          <b>{formatCad(report.metrics.taxPayableCents)}</b>
          <small>Rapport TPS/TVH/TVQ</small>
        </article>
        <article>
          <p>Coûts fournisseurs</p>
          <b>{formatCad(report.metrics.providerCostCents)}</b>
          <small>Lulu et production</small>
        </article>
        <article>
          <p>Marge brute</p>
          <b>{margin} %</b>
          <small>{formatCad(report.metrics.grossMarginCents)}</small>
        </article>
      </div>
      <div className="module-grid">
        <article className="panel accounting-statement">
          <h2>État des résultats · {year}</h2>
          <div className="finance-row">
            <span>Revenus</span>
            <b>{formatCad(report.metrics.revenueCents)}</b>
          </div>
          <div className="finance-row">
            <span>Impression et livraison</span>
            <b>− {formatCad(report.metrics.providerCostCents)}</b>
          </div>
          <div className="finance-row">
            <span>Frais de paiement</span>
            <b>− {formatCad(report.metrics.paymentFeeCents)}</b>
          </div>
          <div className="finance-row total">
            <span>Marge brute</span>
            <b>{formatCad(report.metrics.grossMarginCents)}</b>
          </div>
          <small>
            Les dépenses manuelles du grand livre sont présentées dans le
            journal ci-dessous. À faire valider par la comptable avant dépôt
            fiscal.
          </small>
        </article>
        <article className="panel accounting-statement">
          <h2>Bilan comptable</h2>
          {report.accounts
            .filter((account) =>
              ["asset", "liability", "equity"].includes(account.account_type),
            )
            .map((account) => (
              <div className="finance-row" key={account.code}>
                <span>
                  {account.code} · {account.name}
                </span>
                <b>{formatCad(report.balances[account.code] || 0)}</b>
              </div>
            ))}
          <small>
            Bilan imprimable basé sur les écritures comptables enregistrées.
          </small>
        </article>
      </div>
      <div className="module-grid">
        <form className="panel accounting-entry-form" onSubmit={addExpense}>
          <h2>Ajouter une dépense payée</h2>
          <label>
            Date
            <input
              name="entryDate"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </label>
          <label>
            Référence
            <input name="reference" required placeholder="FOURN-2026-001" />
          </label>
          <label>
            Description
            <input
              name="description"
              required
              placeholder="Fournisseur, logiciel, matériel…"
            />
          </label>
          <label>
            Montant CAD
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
            />
          </label>
          <button className="button button-small">Comptabiliser</button>
          {notice ? <p className="cloud-notice">{notice}</p> : null}
        </form>
        <article className="panel">
          <h2>Rapports disponibles</h2>
          <ul className="check-list">
            <li>✓ État des résultats</li>
            <li>✓ Bilan actif / passif / capitaux propres</li>
            <li>✓ Taxes collectées</li>
            <li>✓ Marge par commande</li>
            <li>✓ Journal et grand livre</li>
            <li>✓ Factures et pro forma imprimables</li>
          </ul>
          <button onClick={() => window.print()}>
            Imprimer / enregistrer en PDF
          </button>
        </article>
      </div>
      <article className="panel admin-data-table">
        <h2>Commandes et pièces comptables</h2>
        <div className="data-row five header">
          <span>Commande</span>
          <span>Client</span>
          <span>Total</span>
          <span>Statut</span>
          <span>Document</span>
        </div>
        {report.orders.map((order) => (
          <div className="data-row five" key={order.id}>
            <span>{order.order_number}</span>
            <span>{order.customer_email}</span>
            <span>{formatCad(order.total_cents)}</span>
            <span>{order.status}</span>
            <span>
              <a href={`/admin/factures/${order.id}`} target="_blank">
                Imprimer
              </a>
            </span>
          </div>
        ))}
      </article>
      <article className="panel admin-data-table">
        <h2>Journal comptable</h2>
        <div className="data-row four header">
          <span>Date</span>
          <span>Référence</span>
          <span>Description</span>
          <span>Statut</span>
        </div>
        {report.entries.map((entry) => (
          <div className="data-row four" key={entry.id}>
            <span>{entry.entry_date}</span>
            <span>{entry.reference}</span>
            <span>{entry.description}</span>
            <span>{entry.status}</span>
          </div>
        ))}
      </article>
    </div>
  );
}
