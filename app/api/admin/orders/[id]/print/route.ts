import { fulfilProdigiOrder, snapshotFromItems, syncProdigiOrder } from '../../../../../../lib/prodigi-fulfilment';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAccountUser } from '../../../../../account-auth';
import { isAdmin } from '../../../../../../lib/admin-auth';
import { getProdigiConfiguration, getProdigiQuote, ProdigiApiError } from '../../../../../../lib/prodigi';
import { supabaseMediaBucket } from '../../../../../../lib/supabase/config';
import { createSupabaseAdminClient } from '../../../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const actionSchema = z.object({ action: z.enum(['quote', 'submit', 'sync']) });
export const maxDuration = 300;

async function authorize() {
  const user = await getAccountUser();
  return user && (await isAdmin(user)) ? user : null;
}

async function contextForOrder(orderId: string) {
  const db = createSupabaseAdminClient();
  if (!db) throw new Error('database');
  const { data: order } = await db.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) throw new Error('order');
  const { data: artifact } = await db.from('print_artifacts').select('*').eq('order_id', orderId).maybeSingle();
  return { db, order, artifact };

}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await authorize()) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  try {
    const { id } = await context.params;
    const { db, order, artifact } = await contextForOrder(id);
    const file = new URL(request.url).searchParams.get('file');
    if ((file === 'interior' || file === 'cover') && artifact) {
      const key = file === 'interior' ? artifact.interior_object_key : artifact.cover_object_key;
      const { data } = await db.storage.from(supabaseMediaBucket).createSignedUrl(key, 10 * 60, { download: `${order.order_number}-${file}.pdf` });
      if (!data?.signedUrl) return NextResponse.json({ error: 'Fichier indisponible.' }, { status: 404 });
      return NextResponse.redirect(data.signedUrl);
    }
    return NextResponse.json({ order: { id: order.id, status: order.status, printerOrderId: order.lulu_print_job_id, printerStatus: order.lulu_status, trackingUrl: order.tracking_url }, artifact, prodigi: getProdigiConfiguration() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === 'order' ? 'Commande introuvable.' : 'Dossier d’impression incomplet.' }, { status: 404 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await authorize()) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
  try {
    const { id } = await context.params;
    const current = await contextForOrder(id);
    const prodigi = getProdigiConfiguration();
    if (snapshotFromItems(current.order.items)?.printer !== 'prodigi') {
      return NextResponse.json({ error: 'Cette ancienne commande requiert un nouveau bon à tirer avant fabrication.' }, { status: 409 });
    }
    if (!prodigi.configured) return NextResponse.json({ error: 'Connexion fournisseur indisponible.' }, { status: 503 });
    const countryCode = current.order.shipping_address?.countryCode || 'CA';

    if (parsed.data.action === 'quote') {
      if (!current.artifact) return NextResponse.json({ error: 'Le PDF de production est encore indisponible.' }, { status: 409 });
      const quote = await getProdigiQuote({ sku: prodigi.sku, copies: current.order.quantity, pageCount: current.artifact.page_count, countryCode, printAreas: ['default'] });
      await current.db.from('print_artifacts').update({ cost_quote: quote, updated_at: new Date().toISOString() }).eq('id', current.artifact.id);
      await current.db.from('orders').update({ lulu_cost_quote: quote, updated_at: new Date().toISOString() }).eq('id', current.order.id);
      const best = quote.quotes?.[0]?.costSummary;
      return NextResponse.json({ quote, message: best ? `Prodigi : livre ${best.items?.amount} ${best.items?.currency} + livraison ${best.shipping?.amount} ${best.shipping?.currency}` : 'Devis reçu.' });
    }

    if (parsed.data.action === 'submit') {
      const result=await fulfilProdigiOrder(current.order.id);
      return NextResponse.json({result,message:'Le traitement automatique a été demandé. Consultez le statut de production.'});
    }

    if (!current.order.lulu_print_job_id) return NextResponse.json({ error: 'Aucune commande Prodigi à synchroniser.' }, { status: 409 });
    await syncProdigiOrder(current.order.id);
    return NextResponse.json({ message: 'Suivi actualisé.' });
  } catch (error) {
    console.error('Print production action failed', error);
    if (error instanceof ProdigiApiError) return NextResponse.json({ error: `Prodigi a refusé la demande (${error.message}).`, details: error.details }, { status: 502 });
    return NextResponse.json({ error: 'L’action d’impression a échoué. Consultez le statut de la commande.' }, { status: 503 });
  }
}
