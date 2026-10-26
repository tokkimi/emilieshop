'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ORDER_STATUS, dateOnly, money, readJson } from './admin/format';
import './admin/admin-tools.css';

type Category = { code: string; name: string };
type Line = { account_code: string; debit_cents: number; credit_cents: number; memo: string | null };
type Report = {
  year: number;
  orders: Array<{ id: string; order_number: string; status: string; total_cents: number; tax_cents: number; created_at: string; customer_email: string | null; invoice_number: string | null }>;
  entries: Array<{ id: string; entry_date: string; reference: string; description: string; source: string; status: string; journal_lines: Line[] }>;
  accounts: Array<{ code: string; name: string; account_type: string }>;
  balances: Record<string, number>;
  online: { revenueCents: number; taxCents: number; providerCostCents: number; paymentFeeCents: number; refundCents: number; orderCount: number };
  ledger: { manualRevenueCents: number; expenseCents: number; byCategory: Record<string, number> };
  income: { revenueCents: number; onlineRevenueCents: number; manualRevenueCents: number; orderCostsCents: number; expenseCents: number; netIncomeCents: number };
  taxes: { collectedCents: number; paidCents: number; netToRemitCents: number };
  categories: { expense: Category[]; revenue: Category[]; payment: Category[] };
};

const firstYear = 2026;
const toCents = (value: FormDataEntryValue | null) => Math.round(Number(String(value || '0').replace(',', '.')) * 100);

/** Finances: income statement, taxes, hand-entered expenses and sales, one-click export. */
export function AccountingDashboard() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const load = () =>
    fetch(`/api/admin/accounting?year=${year}`)
      .then((response) => readJson<Report>(response))
      .then((value) => {
        setReport(value);
        setError('');
      })
      .catch((reason: Error) => setError(reason.message));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const years = Array.from({ length: Math.max(1, new Date().getFullYear() - firstYear + 2) }, (_, index) => firstYear + index);
  return (
    <div className="admin-module accounting-module">
      <div className="at-toolbar">
        <label className="at-toolbar">
          Exercice
          <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {years.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <a className="at-btn primary" href={`/api/admin/accounting/export?year=${year}`}>⬇ Télécharger toute la compta {year} (ZIP)</a>
        <button className="at-btn" type="button" onClick={() => window.print()}>Imprimer / PDF</button>
      </div>
      {error ? <p className="at-notice error">{error}</p> : null}
      {!report ? (
        !error ? <article className="at-panel"><p className="at-empty">Chargement de la comptabilité…</p></article> : null
      ) : (
        <>
          <section className="at-kpis">
            <article><p>Revenus {year}</p><b>{money(report.income.revenueCents)}</b><small>En ligne {money(report.income.onlineRevenueCents)} · manuels {money(report.income.manualRevenueCents)}</small></article>
            <article><p>Dépenses</p><b>{money(report.income.orderCostsCents + report.income.expenseCents)}</b><small>Commandes + frais généraux</small></article>
            <article><p>Bénéfice net</p><b>{money(report.income.netIncomeCents)}</b><small>Avant impôts</small></article>
            <article><p>Taxes à remettre</p><b>{money(report.taxes.netToRemitCents)}</b><small>Perçues {money(report.taxes.collectedCents)} − payées {money(report.taxes.paidCents)}</small></article>
          </section>
          <div className="at-grid">
            <article className="at-panel">
              <h2>État des résultats · {year}</h2>
              <p className="at-sub">Hors taxes</p>
              <table className="at-table">
                <tbody>
                  <tr><td>Ventes en ligne ({report.online.orderCount} commandes, après remboursements)</td><td className="num">{money(report.income.onlineRevenueCents)}</td></tr>
                  <tr><td>Ventes saisies à la main</td><td className="num">{money(report.income.manualRevenueCents)}</td></tr>
                  <tr><td><b>Total des revenus</b></td><td className="num"><b>{money(report.income.revenueCents)}</b></td></tr>
                  <tr><td>Impression des commandes</td><td className="num">− {money(report.online.providerCostCents)}</td></tr>
                  <tr><td>Frais de paiement des commandes</td><td className="num">− {money(report.online.paymentFeeCents)}</td></tr>
                  {Object.entries(report.ledger.byCategory).map(([name, cents]) => <tr key={name}><td>{name}</td><td className="num">− {money(cents)}</td></tr>)}
                  <tr><td><b>Bénéfice net avant impôts</b></td><td className="num"><b>{money(report.income.netIncomeCents)}</b></td></tr>
                </tbody>
              </table>
            </article>
            <article className="at-panel">
              <h2>Taxes (TPS / TVQ)</h2>
              <p className="at-sub">À déclarer à Revenu Québec</p>
              <table className="at-table">
                <tbody>
                  <tr><td>Perçues sur les ventes en ligne</td><td className="num">{money(report.online.taxCents)}</td></tr>
                  <tr><td>Perçues sur les ventes manuelles</td><td className="num">{money(report.taxes.collectedCents - report.online.taxCents)}</td></tr>
                  <tr><td>Payées sur les dépenses (CTI / RTI)</td><td className="num">− {money(report.taxes.paidCents)}</td></tr>
                  <tr><td><b>Net à remettre</b></td><td className="num"><b>{money(report.taxes.netToRemitCents)}</b></td></tr>
                </tbody>
              </table>
              <h2 style={{ marginTop: 22 }}>Soldes du grand livre</h2>
              <p className="at-sub">Saisies manuelles seulement : les ventes du site sont comptées par commande, ci-dessus.</p>
              <table className="at-table">
                <tbody>
                  {report.accounts.filter((account) => ['asset', 'liability', 'equity'].includes(account.account_type)).map((account) => (
                    <tr key={account.code}><td>{account.code} · {account.name}</td><td className="num">{money(report.balances[account.code] || 0)}</td></tr>
                  ))}
                </tbody>
              </table>
            </article>
          </div>
          <div className="at-grid">
            <QuickEntryForm kind="expense" report={report} saved={() => void load()} />
            <QuickEntryForm kind="sale" report={report} saved={() => void load()} />
          </div>
          <EntriesTable report={report} saved={() => void load()} />
          <article className="at-panel">
            <h2>Commandes et factures · {year}</h2>
            <p className="at-sub">Ventes du site</p>
            {report.orders.length ? (
              <div className="at-scroll">
                <table className="at-table">
                  <thead><tr><th>Commande</th><th>Date</th><th>Client</th><th>Statut</th><th className="num">Taxes</th><th className="num">Total</th><th>Facture</th></tr></thead>
                  <tbody>
                    {[...report.orders].reverse().map((order) => (
                      <tr key={order.id}>
                        <td>{order.order_number}</td>
                        <td className="muted">{dateOnly(order.created_at)}</td>
                        <td>{order.customer_email || '—'}</td>
                        <td><span className={`at-pill ${ORDER_STATUS[order.status]?.tone || ''}`}>{ORDER_STATUS[order.status]?.label || order.status}</span></td>
                        <td className="num">{money(order.tax_cents)}</td>
                        <td className="num">{money(order.total_cents)}</td>
                        <td><a href={`/admin/factures/${order.id}`} target="_blank" rel="noreferrer">{order.invoice_number || 'Imprimer'}</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="at-empty">Aucune commande pour cet exercice.</p>}
          </article>
        </>
      )}
    </div>
  );
}

function QuickEntryForm({ kind, report, saved }: { kind: 'expense' | 'sale'; report: Report; saved: () => void }) {
  const expense = kind === 'expense';
  const categories = expense ? report.categories.expense : report.categories.revenue;
  const payments = report.categories.payment.filter((item) => (expense ? item.code !== '1100' : item.code !== '2200'));
  const [amount, setAmount] = useState('');
  const [taxed, setTaxed] = useState(true);
  const [gst, setGst] = useState('');
  const [qst, setQst] = useState('');
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  // Taxes follow the amount (TPS 5 %, TVQ 9,975 %) until edited by hand.
  const onAmount = (value: string) => {
    setAmount(value);
    const cents = toCents(value);
    setGst(taxed ? (Math.round(cents * 0.05) / 100).toFixed(2) : '0.00');
    setQst(taxed ? (Math.round(cents * 0.09975) / 100).toFixed(2) : '0.00');
  };
  const onTaxed = (value: boolean) => {
    setTaxed(value);
    const cents = toCents(amount);
    setGst(value ? (Math.round(cents * 0.05) / 100).toFixed(2) : '0.00');
    setQst(value ? (Math.round(cents * 0.09975) / 100).toFixed(2) : '0.00');
  };
  const total = toCents(amount) + toCents(gst) + toCents(qst);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setNotice(null);
    try {
      const result = await readJson<{ reference: string }>(
        await fetch('/api/admin/accounting/quick', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind,
            date: form.get('date'),
            label: form.get('label'),
            party: form.get('party'),
            category: form.get('category'),
            paymentAccount: form.get('payment'),
            reference: String(form.get('reference') || '').trim() || undefined,
            amountCents: toCents(amount),
            gstCents: toCents(gst),
            qstCents: toCents(qst),
          }),
        }),
      );
      setNotice({ text: `${expense ? 'Dépense' : 'Vente'} enregistrée (${result.reference}).` });
      formElement.reset();
      setAmount('');
      setGst('');
      setQst('');
      saved();
    } catch (reason) {
      setNotice({ text: (reason as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="at-panel at-form" onSubmit={submit}>
      <h2>{expense ? 'Ajouter une dépense' : 'Ajouter une vente manuelle'}</h2>
      <p className="at-sub">{expense ? 'Facture fournisseur, abonnement, publicité, matériel…' : 'Vente hors site : salon, virement, comptant…'}</p>
      <div className="row">
        <label>Date<input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
        <label>{expense ? 'Fournisseur' : 'Client'}<input name="party" required placeholder={expense ? 'ex. Prodigi, Mpix, Meta' : 'ex. Famille Tremblay'} /></label>
      </div>
      <label>Description<input name="label" required minLength={2} placeholder={expense ? 'ex. Publicité Facebook octobre' : 'ex. Livre Souvenir — salon de l’habitation'} /></label>
      <div className="row">
        <label>Catégorie<select name="category" defaultValue={categories[0]?.code}>{categories.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
        <label>{expense ? 'Payée' : 'Encaissée'}<select name="payment" defaultValue="1000">{payments.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
      </div>
      <div className="row">
        <label>Montant avant taxes ($)<input inputMode="decimal" required value={amount} onChange={(event) => onAmount(event.target.value)} placeholder="0,00" /></label>
        <label>N° de facture / pièce (facultatif)<input name="reference" maxLength={60} /></label>
      </div>
      <label className="check"><input type="checkbox" checked={taxed} onChange={(event) => onTaxed(event.target.checked)} /> Taxable (TPS 5 % + TVQ 9,975 %)</label>
      <div className="row">
        <label>TPS ($)<input inputMode="decimal" value={gst} onChange={(event) => setGst(event.target.value)} /></label>
        <label>TVQ ($)<input inputMode="decimal" value={qst} onChange={(event) => setQst(event.target.value)} /></label>
      </div>
      <div className="at-actions">
        <button className="at-btn primary" disabled={busy || total <= 0}>{busy ? 'Enregistrement…' : `Enregistrer · ${money(total)} TTC`}</button>
      </div>
      {notice ? <p className={`at-notice ${notice.error ? 'error' : ''}`}>{notice.text}</p> : null}
    </form>
  );
}

function EntriesTable({ report, saved }: { report: Report; saved: () => void }) {
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const name = (code: string) => report.accounts.find((account) => account.code === code)?.name || code;
  const cancel = async (id: string, reference: string) => {
    const reason = window.prompt(`Annuler l’écriture ${reference} ? Indiquez la raison :`);
    if (!reason) return;
    try {
      await readJson(await fetch('/api/admin/accounting/quick', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, reason }) }));
      setNotice({ text: `Écriture ${reference} annulée (elle reste visible, barrée, pour l’historique).` });
      saved();
    } catch (error) {
      setNotice({ text: (error as Error).message, error: true });
    }
  };
  return (
    <article className="at-panel">
      <h2>Journal des écritures · {report.year}</h2>
      <p className="at-sub">Dépenses, ventes manuelles et ajustements</p>
      {notice ? <p className={`at-notice ${notice.error ? 'error' : ''}`}>{notice.text}</p> : null}
      {report.entries.length ? (
        <div className="at-scroll">
          <table className="at-table">
            <thead><tr><th>Date</th><th>Référence</th><th>Description</th><th>Comptes</th><th className="num">Montant</th><th /></tr></thead>
            <tbody>
              {[...report.entries].reverse().map((entry) => {
                const lines = entry.journal_lines || [];
                const totalCents = lines.reduce((sum, line) => sum + line.debit_cents, 0);
                const voided = entry.status === 'void';
                return (
                  <tr key={entry.id} style={voided ? { textDecoration: 'line-through', opacity: 0.55 } : undefined}>
                    <td className="muted">{entry.entry_date}</td>
                    <td>{entry.reference}</td>
                    <td>{entry.description}</td>
                    <td className="muted">{lines.filter((line) => !['1000', '1100', '2200', '2100'].includes(line.account_code)).map((line) => name(line.account_code)).join(', ')}</td>
                    <td className="num">{money(totalCents)}</td>
                    <td className="num">{voided ? 'Annulée' : entry.source !== 'order' ? <button className="at-btn danger" type="button" onClick={() => void cancel(entry.id, entry.reference)}>Annuler</button> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="at-empty">Aucune écriture pour cet exercice. Ajoutez une dépense ou une vente ci-dessus.</p>}
    </article>
  );
}
