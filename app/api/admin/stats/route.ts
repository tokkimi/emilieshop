import { NextResponse } from 'next/server';
import { adminContext, badRequest, fetchAll, PAID_STATUSES } from '../../../../lib/admin-api';

export const dynamic = 'force-dynamic';

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  product_code: string | null;
  total_cents: number;
  subtotal_cents: number;
  shipping_cents: number;
  tax_cents: number;
  refund_cents: number;
  provider_cost_cents: number;
  payment_fee_cents: number;
  customer_email: string | null;
  created_at: string;
  paid_at: string | null;
};
type EventRow = { visitor_id: string; event_name: string; path: string; metadata: Record<string, unknown> | null; created_at: string };

const TIME_ZONE = 'America/Toronto';
const day = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TIME_ZONE });

function count<T>(rows: T[], key: (row: T) => string | null | undefined, limit = 12) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const value = key(row);
    if (value) totals.set(value, (totals.get(value) || 0) + 1);
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([label, value]) => ({ label, value }));
}

/** Sales and visits over a period: daily series, breakdowns, funnel. */
export async function GET(request: Request) {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;
  const days = Number(new URL(request.url).searchParams.get('days') || 30);
  if (![7, 30, 90, 365].includes(days)) return badRequest('Période invalide');
  const since = new Date(Date.now() - (days - 1) * 86_400_000);
  since.setHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();

  let orders: OrderRow[];
  let events: EventRow[];
  try {
    [orders, events] = await Promise.all([
      fetchAll<OrderRow>((from, to) =>
        ctx.db
          .from('orders')
          .select('id,order_number,status,product_code,total_cents,subtotal_cents,shipping_cents,tax_cents,refund_cents,provider_cost_cents,payment_fee_cents,customer_email,created_at,paid_at')
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: true })
          .range(from, to),
      ),
      fetchAll<EventRow>((from, to) =>
        ctx.db
          .from('analytics_events')
          .select('visitor_id,event_name,path,metadata,created_at')
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: true })
          .range(from, to),
      ),
    ]);
  } catch {
    return badRequest('Statistiques indisponibles', 503);
  }

  // One bucket per calendar day of the period, so empty days show as zero.
  const series = new Map<string, { date: string; revenueCents: number; orders: number; visits: Set<string>; pageViews: number }>();
  for (let i = 0; i < days; i += 1) {
    const date = day(new Date(since.getTime() + i * 86_400_000 + 12 * 3_600_000).toISOString());
    series.set(date, { date, revenueCents: 0, orders: 0, visits: new Set(), pageViews: 0 });
  }

  const paid = orders.filter((order) => PAID_STATUSES.includes(order.status));
  for (const order of paid) {
    const bucket = series.get(day(order.paid_at || order.created_at));
    if (!bucket) continue;
    bucket.revenueCents += order.subtotal_cents + order.shipping_cents - order.refund_cents;
    bucket.orders += 1;
  }
  const views = events.filter((event) => event.event_name === 'page_view');
  for (const event of views) {
    const bucket = series.get(day(event.created_at));
    if (!bucket) continue;
    bucket.visits.add(event.visitor_id);
    bucket.pageViews += 1;
  }

  const revenueCents = paid.reduce((sum, order) => sum + order.subtotal_cents + order.shipping_cents - order.refund_cents, 0);
  const sessions = new Set(views.map((event) => event.visitor_id));
  const sessionsReaching = (test: (path: string) => boolean) =>
    new Set(views.filter((event) => test(event.path)).map((event) => event.visitor_id)).size;
  const products = new Map<string, { label: string; orders: number; revenueCents: number }>();
  for (const order of paid) {
    const label = order.product_code || 'Autre';
    const entry = products.get(label) || { label, orders: 0, revenueCents: 0 };
    entry.orders += 1;
    entry.revenueCents += order.subtotal_cents + order.shipping_cents - order.refund_cents;
    products.set(label, entry);
  }
  const pagesPerSession = sessions.size ? views.length / sessions.size : 0;

  return NextResponse.json({
    days,
    since: sinceIso,
    sales: {
      revenueCents,
      taxCents: paid.reduce((sum, order) => sum + order.tax_cents, 0),
      refundCents: paid.reduce((sum, order) => sum + order.refund_cents, 0),
      costCents: paid.reduce((sum, order) => sum + order.provider_cost_cents + order.payment_fee_cents, 0),
      paidOrders: paid.length,
      allOrders: orders.length,
      averageCents: paid.length ? Math.round(revenueCents / paid.length) : 0,
      byStatus: count(orders, (order) => order.status, 20),
      byProduct: [...products.values()].sort((a, b) => b.revenueCents - a.revenueCents),
      recent: orders.slice(-12).reverse(),
    },
    visits: {
      sessions: sessions.size,
      pageViews: views.length,
      pagesPerSession: Math.round(pagesPerSession * 10) / 10,
      conversion: sessions.size ? Math.round((paid.length / sessions.size) * 10_000) / 100 : 0,
      topPages: count(views, (event) => event.path, 15),
      referrers: count(views, (event) => (event.metadata?.referrer as string) || 'Accès direct'),
      devices: count(views, (event) => event.metadata?.device as string),
      countries: count(views, (event) => [event.metadata?.country, event.metadata?.region].filter(Boolean).join(' · ') || null),
      campaigns: count(views, (event) => (event.metadata?.utm_campaign as string) || (event.metadata?.utm_source as string)),
      languages: count(views, (event) => ((event.metadata?.lang as string) === 'en' ? 'Anglais' : 'Français')),
      funnel: [
        { label: 'Visites', value: sessions.size },
        { label: 'Atelier ouvert', value: sessionsReaching((path) => path.startsWith('/atelier') || path.startsWith('/en/studio')) },
        { label: 'Page commande', value: sessionsReaching((path) => path.startsWith('/commande') || path.startsWith('/en/order')) },
        { label: 'Commandes payées', value: paid.length },
      ],
    },
    series: [...series.values()].map(({ visits, ...bucket }) => ({ ...bucket, visits: visits.size })),
  });
}
