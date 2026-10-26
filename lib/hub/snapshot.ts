import { createSupabaseAdminClient } from '../supabase/server';
import { getLuluConfiguration } from '../lulu';
import type { HubActionResult, HubSnapshot } from './types';

// Sections de l'administration Mémoire Maison, exposées à la console centrale.
// Lecture avec la clé serveur Supabase : uniquement les données de Mémoire Maison.

const SITE = 'https://memoiremaison.com';
const PAID = ['paid', 'preflight', 'printing', 'shipped', 'delivered'];
const PRODUCTION = ['approved', 'production', 'shipped', 'delivered'];

const projectStatus: Record<string, string> = {
  draft: 'Brouillon', generating: 'Génération', preview: 'Aperçu', changes_requested: 'Modifications demandées',
  approved: 'Approuvé', production: 'En production', shipped: 'Expédié', delivered: 'Livré', archived: 'Archivé',
};
const orderStatus: Record<string, string> = {
  pending: 'En attente', awaiting_payment: 'En attente de paiement', paid: 'Payé', preflight: 'Contrôle impression',
  printing: 'Impression', shipped: 'Expédié', delivered: 'Livré', cancelled: 'Annulé', refunded: 'Remboursé', blocked: 'Bloqué',
};
const threadStatus: Record<string, string> = { open: 'Ouvert', waiting_customer: 'Répondu', waiting_team: 'En attente', closed: 'Fermé' };
const linkStatus: Record<string, string> = { private: 'Privé', family: 'Famille', paused: 'En pause', expired: 'Expiré' };
const newsletterStatus: Record<string, string> = { pending: 'En attente', subscribed: 'Abonné', unsubscribed: 'Désabonné', bounced: 'Rejeté' };

export class HubError extends Error {}

function db() {
  const client = createSupabaseAdminClient();
  if (!client) throw new HubError('Supabase non configuré (SUPABASE_SECRET_KEY).');
  return client;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function memoireSnapshot(): Promise<HubSnapshot> {
  const supabase = db();
  const year = new Date().getFullYear();
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const [projects, orders, profiles, pros, links, threads, newsletter, events, entries, accounts] = await Promise.all([
    supabase.from('projects').select('id,owner_id,title,address,collection,status,progress,updated_at').order('updated_at', { ascending: false }).limit(300),
    supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(300),
    supabase.from('profiles').select('id,email,display_name,phone,created_at').order('created_at', { ascending: false }).limit(1000),
    supabase.from('professional_accounts').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('memory_links').select('id,owner_id,slug,status,allow_downloads,expires_at,updated_at').order('updated_at', { ascending: false }).limit(300),
    supabase.from('message_threads').select('*').order('updated_at', { ascending: false }).limit(200),
    supabase.from('newsletter_subscribers').select('email,status,segment,locale,consent_at').order('consent_at', { ascending: false }).limit(1000),
    supabase.from('analytics_events').select('event_name,path,visitor_id,created_at').gte('created_at', since30).limit(5000),
    supabase.from('journal_entries').select('id,entry_date,reference,description,source,status,journal_lines(account_code,debit_cents,credit_cents)').gte('entry_date', `${year}-01-01`).lt('entry_date', `${year + 1}-01-01`).order('entry_date', { ascending: false }),
    supabase.from('accounting_accounts').select('code,name,account_type').eq('active', true).order('code'),
  ]);
  const failed = [projects, orders, profiles].find((r) => r.error);
  if (failed) throw new HubError('Base Mémoire Maison indisponible.');

  const profileRows = (profiles.data || []) as any[];
  const owner = new Map(profileRows.map((p) => [p.id, p]));
  const who = (id: string) => { const p = owner.get(id); return p ? p.display_name || p.email : '—'; };
  const projectRows = (projects.data || []) as any[];
  const orderRows = (orders.data || []) as any[];
  const paid = orderRows.filter((o) => PAID.includes(o.status));
  const yearPaid = paid.filter((o) => new Date(o.created_at).getFullYear() === year);
  const revenue = yearPaid.reduce((t, o) => t + (o.subtotal_cents ?? o.total_cents) + (o.shipping_cents ?? 0) - (o.refund_cents ?? 0), 0);
  const taxes = yearPaid.reduce((t, o) => t + (o.tax_cents ?? 0), 0);
  const printing = yearPaid.reduce((t, o) => t + (o.provider_cost_cents ?? 0), 0);
  const fees = yearPaid.reduce((t, o) => t + (o.payment_fee_cents ?? 0), 0);
  const threadRows = (threads.data || []) as any[];
  const waiting = threadRows.filter((t) => t.status === 'waiting_team' || t.status === 'open' || t.unread_admin > 0);
  const eventRows = (events.data || []) as any[];
  const visitors = new Set(eventRows.map((e) => e.visitor_id).filter(Boolean)).size;
  const count = (key: string) => { const m = new Map<string, number>(); for (const e of eventRows) { const k = e[key] || '—'; m.set(k, (m.get(k) || 0) + 1); } return [...m].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([label, value]) => ({ label, value })); };
  const byMonth = new Map<string, number>();
  for (const o of paid) { const k = String(o.created_at).slice(0, 7); byMonth.set(k, (byMonth.get(k) || 0) + o.total_cents); }
  const lulu = getLuluConfiguration();
  const accountName = new Map(((accounts.data || []) as any[]).map((a) => [a.code, a.name]));

  const orderColumns = [
    { key: 'number', label: 'Commande' }, { key: 'date', label: 'Date', format: 'datetime' as const },
    { key: 'client', label: 'Client' }, { key: 'status', label: 'Statut', format: 'badge' as const },
    { key: 'invoice', label: 'Facture' }, { key: 'total', label: 'Total', format: 'money' as const, align: 'right' as const },
  ];
  const orderTable = orderRows.map((o) => ({
    number: o.order_number, date: o.created_at, client: o.customer_email || who(o.owner_id), status: orderStatus[o.status] ?? o.status,
    invoice: o.invoice_number ?? null, total: o.total_cents,
  }));
  const projectTable = (rows: any[]) => rows.map((p) => ({
    title: p.title, client: who(p.owner_id), address: p.address, collection: p.collection,
    status: projectStatus[p.status] ?? p.status, progress: p.progress, updated: p.updated_at,
  }));
  const projectColumns = [
    { key: 'title', label: 'Projet' }, { key: 'client', label: 'Client' }, { key: 'address', label: 'Adresse' }, { key: 'collection', label: 'Offre' },
    { key: 'status', label: 'Statut', format: 'badge' as const }, { key: 'progress', label: 'Progression', format: 'percent' as const, align: 'right' as const },
    { key: 'updated', label: 'Mis à jour', format: 'date' as const },
  ];

  return {
    generatedAt: new Date().toISOString(),
    currency: 'CAD',
    sections: [
      {
        id: 'overview', label: 'Vue d’ensemble', icon: '⌂',
        blocks: [
          { type: 'metrics', items: [
            { label: 'Projets actifs', value: projectRows.filter((p) => !['delivered', 'archived'].includes(p.status)).length },
            { label: 'Commandes payées', value: paid.length },
            { label: `Revenus ${year}`, value: revenue, format: 'money' },
            { label: 'Comptes clients', value: profileRows.length },
            { label: 'Messages en attente', value: waiting.length },
            { label: 'Visiteurs 30 j', value: visitors },
          ] },
          { type: 'table', title: 'Dernières commandes', columns: orderColumns, rows: orderTable.slice(0, 8), empty: 'Aucune commande pour le moment.' },
        ],
      },
      {
        id: 'launch', label: 'Centre de lancement', icon: '✓',
        blocks: [{ type: 'status', title: 'Branchements', items: [
          { label: 'Base de données et comptes Supabase', ok: true },
          { label: 'Administration serveur', ok: !!process.env.SUPABASE_SECRET_KEY, detail: 'SUPABASE_SECRET_KEY' },
          { label: 'Paiements Stripe', ok: !!(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY), detail: 'STRIPE_SECRET_KEY' },
          { label: 'Courriels transactionnels', ok: !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM), detail: 'RESEND_API_KEY' },
          { label: `Impression Lulu (${lulu.environment === 'production' ? 'production' : 'test'})`, ok: lulu.configured, detail: 'LULU_*' },
          { label: 'Envoi automatique à l’impression', ok: lulu.ordersEnabled },
          { label: 'Composition du livre (IA)', ok: !!(process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY) },
        ] }],
      },
      { id: 'projects', label: 'Projets', icon: '▤', badge: projectRows.length || undefined, blocks: [
        { type: 'table', title: 'Projets clients', columns: projectColumns, rows: projectTable(projectRows), empty: 'Aucun projet.' },
      ] },
      { id: 'orders', label: 'Commandes', icon: '□', badge: paid.length || undefined, blocks: [
        { type: 'table', title: 'Commandes', description: 'Les factures se consultent et s’impriment dans l’admin Mémoire Maison.', columns: orderColumns, rows: orderTable, empty: 'Aucune commande.' },
      ] },
      { id: 'users', label: 'Utilisateurs', icon: '◎', badge: profileRows.length || undefined, blocks: [
        { type: 'table', title: 'Comptes', columns: [{ key: 'email', label: 'Courriel' }, { key: 'name', label: 'Nom' }, { key: 'phone', label: 'Téléphone' }, { key: 'created', label: 'Création', format: 'date' }],
          rows: profileRows.map((p) => ({ email: p.email, name: p.display_name, phone: p.phone, created: p.created_at })), empty: 'Aucun compte.' },
      ] },
      { id: 'pros', label: 'Professionnels', icon: '◇', blocks: [
        { type: 'table', title: 'Comptes professionnels', columns: [{ key: 'org', label: 'Organisation' }, { key: 'owner', label: 'Responsable' }, { key: 'bought', label: 'Crédits achetés', align: 'right' }, { key: 'used', label: 'Utilisés', align: 'right' }, { key: 'created', label: 'Création', format: 'date' }],
          rows: ((pros.data || []) as any[]).map((a) => ({ org: a.organization_name, owner: who(a.owner_id), bought: a.credits_purchased, used: a.credits_used, created: a.created_at })), empty: 'Aucun compte professionnel.' },
      ] },
      { id: 'production', label: 'Production', icon: '◫', blocks: [
        { type: 'table', title: 'Suivi de production', columns: projectColumns, rows: projectTable(projectRows.filter((p) => PRODUCTION.includes(p.status))), empty: 'Aucun projet en production.' },
      ] },
      { id: 'links', label: 'Memory Links', icon: '⌁', blocks: [
        { type: 'table', title: 'Pages souvenirs', columns: [{ key: 'slug', label: 'Adresse' }, { key: 'owner', label: 'Client' }, { key: 'status', label: 'Accès', format: 'badge' }, { key: 'downloads', label: 'Téléchargements' }, { key: 'expires', label: 'Expiration', format: 'date' }],
          rows: ((links.data || []) as any[]).map((l) => ({ slug: `/memory/${l.slug}`, owner: who(l.owner_id), status: linkStatus[l.status] ?? l.status, downloads: l.allow_downloads, expires: l.expires_at })), empty: 'Aucun Memory Link.' },
      ] },
      {
        id: 'finances', label: 'Finances', icon: '$',
        blocks: [
          { type: 'metrics', items: [
            { label: `Revenus ${year}`, value: revenue, format: 'money' },
            { label: 'Taxes à remettre', value: taxes, format: 'money' },
            { label: 'Coûts d’impression', value: printing, format: 'money' },
            { label: 'Frais de paiement', value: fees, format: 'money' },
            { label: 'Marge brute', value: revenue - printing - fees, format: 'money' },
          ] },
          { type: 'bars', title: 'Ventes par mois', format: 'money', items: [...byMonth].sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([label, value]) => ({ label, value })) },
          { type: 'form', title: 'Ajouter une dépense payée', description: 'Comptabilisée au grand livre : débit 6000 Dépenses d’exploitation, crédit 1000 Banque.', action: { label: 'Comptabiliser', action: 'expense', fields: [
            { name: 'entryDate', label: 'Date', type: 'date', required: true, default: new Date().toISOString().slice(0, 10) },
            { name: 'reference', label: 'Référence', type: 'text', required: true, placeholder: 'FOURN-2026-001' },
            { name: 'description', label: 'Description', type: 'text', required: true, placeholder: 'Fournisseur, logiciel, matériel…' },
            { name: 'amount', label: 'Montant CAD', type: 'number', min: 0.01, required: true },
          ] } },
          { type: 'table', title: `Journal comptable ${year}`, columns: [{ key: 'date', label: 'Date', format: 'date' }, { key: 'ref', label: 'Référence' }, { key: 'desc', label: 'Description' }, { key: 'accounts', label: 'Comptes' }, { key: 'amount', label: 'Montant', format: 'money', align: 'right' }],
            rows: ((entries.data || []) as any[]).map((e) => ({ date: e.entry_date, ref: e.reference, desc: e.description, accounts: (e.journal_lines || []).map((l: any) => accountName.get(l.account_code) || l.account_code).join(' / '), amount: (e.journal_lines || []).reduce((t: number, l: any) => t + l.debit_cents, 0) })),
            empty: 'Aucune écriture cette année.' },
        ],
      },
      { id: 'analytics', label: 'Visites & analytics', icon: '↗', blocks: [
        { type: 'metrics', items: [{ label: 'Visiteurs distincts 30 j', value: visitors }, { label: 'Événements 30 j', value: eventRows.length }] },
        { type: 'bars', title: 'Pages consultées', items: count('path') },
        { type: 'bars', title: 'Événements', items: count('event_name') },
      ] },
      { id: 'newsletter', label: 'Newsletter', icon: '✉', blocks: [
        { type: 'table', title: 'Inscriptions', columns: [{ key: 'email', label: 'Courriel' }, { key: 'status', label: 'Statut', format: 'badge' }, { key: 'segment', label: 'Segment' }, { key: 'locale', label: 'Langue' }, { key: 'date', label: 'Consentement', format: 'date' }],
          rows: ((newsletter.data || []) as any[]).map((n) => ({ email: n.email, status: newsletterStatus[n.status] ?? n.status, segment: n.segment, locale: n.locale, date: n.consent_at })), empty: 'Aucun inscrit.' },
      ] },
      { id: 'messages', label: 'Messagerie', icon: '◉', badge: waiting.length || undefined, blocks: [
        { type: 'table', title: 'Conversations', columns: [{ key: 'status', label: 'État', format: 'badge' }, { key: 'subject', label: 'Sujet' }, { key: 'client', label: 'Client' }, { key: 'unread', label: 'Non lus', align: 'right' }, { key: 'updated', label: 'Dernière activité', format: 'datetime' }],
          rows: threadRows.map((t) => ({ status: threadStatus[t.status] ?? t.status, subject: t.subject, client: who(t.user_id), unread: t.unread_admin, updated: t.updated_at,
            _actions: [{ label: 'Répondre', action: 'reply', payload: { threadId: t.id }, fields: [{ name: 'body', label: 'Réponse', type: 'textarea' as const, required: true }] }] })),
          empty: 'Aucune conversation.' },
      ] },
      { id: 'content', label: 'Contenus & SEO', icon: '✦', blocks: [
        { type: 'notes', items: ['Le contenu public, les métadonnées et le sitemap sont gérés dans le code du site.', 'Aucun éditeur de contenu en production n’est connecté pour le moment.'] },
        { type: 'links', title: 'Raccourcis', items: [{ label: 'Voir le site', href: SITE }, { label: 'Sitemap', href: `${SITE}/sitemap.xml` }] },
      ] },
      { id: 'settings', label: 'Paramètres', icon: '⚙', blocks: [
        { type: 'notes', items: ['Configuration de production contrôlée par les variables Vercel et Supabase.'] },
        { type: 'links', title: 'Raccourcis', items: [{ label: 'Admin Mémoire Maison', href: `${SITE}/admin` }] },
      ] },
    ],
  };
}

const uuid = (v: unknown) => {
  if (typeof v !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) throw new HubError('Identifiant invalide');
  return v;
};

// Profil Supabase d'Emilie (ADMIN_EMAILS), utilisé comme expéditeur et auteur des écritures.
async function ownerProfile(supabase: ReturnType<typeof db>) {
  const emails = (process.env.ADMIN_EMAILS || 'emilie@equipecauvier.com').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  const { data } = await supabase.from('profiles').select('id,email').in('email', emails).limit(1);
  return (data?.[0]?.id as string | undefined) ?? null;
}

export async function memoireAction(action: string, p: Record<string, unknown>): Promise<HubActionResult> {
  const supabase = db();
  if (action === 'reply') {
    const threadId = uuid(p.threadId);
    const body = typeof p.body === 'string' ? p.body.trim() : '';
    if (!body || body.length > 5000) throw new HubError('Message vide ou trop long.');
    const sender = await ownerProfile(supabase);
    if (!sender) throw new HubError('Créez d’abord le compte Mémoire Maison d’Emilie (ADMIN_EMAILS) pour répondre.');
    const { data: thread } = await supabase.from('message_threads').select('id,unread_customer').eq('id', threadId).single();
    if (!thread) throw new HubError('Conversation introuvable.');
    const { error } = await supabase.from('messages').insert({ thread_id: threadId, sender_id: sender, body });
    if (error) throw new HubError('Message refusé.');
    await supabase.from('message_threads').update({ status: 'waiting_customer', unread_admin: 0, unread_customer: (thread.unread_customer || 0) + 1, updated_at: new Date().toISOString() }).eq('id', threadId);
    return { ok: true, message: 'Réponse envoyée.' };
  }
  if (action === 'expense') {
    const entryDate = String(p.entryDate || '');
    const reference = String(p.reference || '').trim();
    const description = String(p.description || '').trim();
    const cents = Math.round(Number(p.amount) * 100);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate) || reference.length < 2 || reference.length > 80 || description.length < 2 || description.length > 240 || !Number.isInteger(cents) || cents <= 0) throw new HubError('Écriture invalide.');
    const id = crypto.randomUUID();
    const { error } = await supabase.from('journal_entries').insert({ id, entry_date: entryDate, reference, description, source: 'supplier', status: 'posted', created_by: await ownerProfile(supabase) });
    if (error) throw new HubError('Référence déjà utilisée ou écriture invalide.');
    const { error: lineError } = await supabase.from('journal_lines').insert([
      { entry_id: id, account_code: '6000', debit_cents: cents, credit_cents: 0, memo: description },
      { entry_id: id, account_code: '1000', debit_cents: 0, credit_cents: cents, memo: 'Paiement' },
    ]);
    if (lineError) { await supabase.from('journal_entries').delete().eq('id', id); throw new HubError('Comptes comptables invalides.'); }
    return { ok: true, message: 'Dépense enregistrée dans le grand livre.' };
  }
  throw new HubError('Action introuvable');
}
