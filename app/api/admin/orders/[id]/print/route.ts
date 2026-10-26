import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getChatGPTUser } from '../../../../../chatgpt-auth';
import { isAdmin } from '../../../../../../lib/admin-auth';
import { ensureCompleteBook, type GeneratedBook } from '../../../../../../lib/book';
import { PRINTERS, printerFromOptions, type PrinterId } from '../../../../../../lib/printers';
import { getProdigiConfiguration, getProdigiProduct, getProdigiQuote, getProdigiSpineMm, prodigiOrderState, prodigiRequest, ProdigiApiError } from '../../../../../../lib/prodigi';
import { buildPrintPdfs } from '../../../../../../lib/print-pdf';
import { supabaseMediaBucket } from '../../../../../../lib/supabase/config';
import { createSupabaseAdminClient } from '../../../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const actionSchema = z.object({ action: z.enum(['prepare', 'quote', 'submit', 'mark-ordered', 'sync']), reference: z.string().max(120).optional() });

// The provider's order id, status and quote reuse the original print columns of
// the orders table (lulu_print_job_id, lulu_status, lulu_cost_quote).
const POINTS_PER_INCH = 72;
const TRIM = { width: 8.5 * POINTS_PER_INCH, height: 11 * POINTS_PER_INCH };
const COVER_WRAP = 0.75 * POINTS_PER_INCH;
const DEFAULT_SPINE_MM = 10;
type Address = { name?: string; street1?: string; street2?: string; city?: string; regionCode?: string; countryCode?: string; postalCode?: string; phone?: string };
type Artifact = { id:string; order_id:string; project_id:string; owner_id:string; generation_id:string; approval_id:string; version:number; version_hash:string; pod_package_id:string; page_count:number; interior_object_key:string; cover_object_key:string; interior_md5:string; cover_md5:string; cover_width_pt:number; cover_height_pt:number; warnings:unknown[]; cost_quote:unknown; status:string };

async function authorize() {
  const user = await getChatGPTUser();
  return user && (await isAdmin(user)) ? user : null;
}

async function signedPrintUrls(db: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, artifact: Artifact) {
  const [{ data: interior, error: interiorError }, { data: cover, error: coverError }] = await Promise.all([
    db.storage.from(supabaseMediaBucket).createSignedUrl(artifact.interior_object_key, 7 * 24 * 60 * 60),
    db.storage.from(supabaseMediaBucket).createSignedUrl(artifact.cover_object_key, 7 * 24 * 60 * 60),
  ]);
  if (interiorError || coverError || !interior?.signedUrl || !cover?.signedUrl) throw new Error('signed-files');
  return { interiorUrl: interior.signedUrl, coverUrl: cover.signedUrl };
}

async function contextForOrder(orderId: string) {
  const db = createSupabaseAdminClient();
  if (!db) throw new Error('database');
  const { data: order } = await db.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) throw new Error('order');
  const [{ data: generation }, { data: approval }, { data: artifact }] = await Promise.all([
    db.from('book_generations').select('*').eq('project_id', order.project_id).eq('owner_id', order.owner_id).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('approvals').select('*').eq('project_id', order.project_id).eq('owner_id', order.owner_id).order('approved_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('print_artifacts').select('*').eq('order_id', orderId).maybeSingle(),
  ]);
  if (!generation || !approval) throw new Error('approval');
  if (generation.version !== approval.version) throw new Error('version');
  const { data: project } = await db.from('projects').select('options').eq('id', order.project_id).maybeSingle();
  const printer: PrinterId = printerFromOptions(project?.options) || 'prodigi';
  return { db, order, generation, approval, printer, artifact: artifact as Artifact | null };
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await authorize()) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  try {
    const { id } = await context.params;
    const { order, artifact, printer } = await contextForOrder(id);
    const file = new URL(request.url).searchParams.get('file');
    if ((file === 'interior' || file === 'cover') && artifact) {
      const key = file === 'interior' ? artifact.interior_object_key : artifact.cover_object_key;
      const db = createSupabaseAdminClient();
      const { data } = await db!.storage.from(supabaseMediaBucket).createSignedUrl(key, 10 * 60, { download: `${order.order_number}-${file}.pdf` });
      if (!data?.signedUrl) return NextResponse.json({ error: 'Fichier indisponible.' }, { status: 404 });
      return NextResponse.redirect(data.signedUrl);
    }
    return NextResponse.json({ printer, order: { id: order.id, status: order.status, printerOrderId: order.lulu_print_job_id, printerStatus: order.lulu_status, trackingUrl: order.tracking_url }, artifact, prodigi: getProdigiConfiguration() });
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
    const usesProdigi = current.printer === 'prodigi';
    if (usesProdigi && !prodigi.configured && parsed.data.action !== 'prepare') return NextResponse.json({ error: 'Ajoutez la clé PRODIGI_API_KEY dans Vercel.' }, { status: 503 });
    const address = current.order.shipping_address as Address;
    const countryCode = address.countryCode || 'CA';

    if (parsed.data.action === 'prepare') {
      const book = ensureCompleteBook(current.generation.result_data as GeneratedBook);
      // Spine from Prodigi when connected (page count is refined after the PDF is built).
      const spineMm = usesProdigi && prodigi.configured ? await getProdigiSpineMm(prodigi.sku, 24, countryCode).catch(() => null) : null;
      const spine = ((spineMm || DEFAULT_SPINE_MM) / 25.4) * POINTS_PER_INCH;
      const coverWidth = TRIM.width * 2 + spine + COVER_WRAP * 2;
      const coverHeight = TRIM.height + COVER_WRAP * 2;
      const mediaCache = new Map<string, { bytes:Uint8Array; contentType:string } | null>();
      const loadMedia = async (item: { id:string }) => {
        if (mediaCache.has(item.id)) return mediaCache.get(item.id) || null;
        const { data: media } = await current.db.from('media').select('object_key,content_type').eq('id', item.id).eq('owner_id', current.order.owner_id).maybeSingle();
        if (!media) { mediaCache.set(item.id, null); return null; }
        const { data, error } = await current.db.storage.from(supabaseMediaBucket).download(media.object_key);
        if (error || !data) { mediaCache.set(item.id, null); return null; }
        const loaded = { bytes: new Uint8Array(await data.arrayBuffer()), contentType: media.content_type };
        mediaCache.set(item.id, loaded); return loaded;
      };
      let { data: memoryLink } = await current.db.from('memory_links').select('slug').eq('project_id', current.order.project_id).maybeSingle();
      if (!memoryLink) {
        const slug = randomBytes(18).toString('base64url');
        const { data } = await current.db.from('memory_links').insert({ project_id: current.order.project_id, owner_id: current.order.owner_id, slug, status: 'private' }).select('slug').single();
        memoryLink = data;
      }
      const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://memoiremaison.com';
      const pdfs = await buildPrintPdfs({ book, coverWidth, coverHeight, memoryUrl: `${origin}/memory/${memoryLink!.slug}`, loadMedia });
      const artifactId = current.artifact?.id || crypto.randomUUID();
      const baseKey = `${current.order.owner_id}/${current.order.project_id}/print/${current.order.id}/${current.generation.version}`;
      const interiorKey = `${baseKey}/interior.pdf`; const coverKey = `${baseKey}/cover.pdf`;
      const [interiorUpload, coverUpload] = await Promise.all([
        current.db.storage.from(supabaseMediaBucket).upload(interiorKey, pdfs.interior, { contentType: 'application/pdf', upsert: true }),
        current.db.storage.from(supabaseMediaBucket).upload(coverKey, pdfs.cover, { contentType: 'application/pdf', upsert: true }),
      ]);
      if (interiorUpload.error || coverUpload.error) throw new Error('upload');
      const record = { id: artifactId, order_id: current.order.id, project_id: current.order.project_id, owner_id: current.order.owner_id, generation_id: current.generation.id, approval_id: current.approval.id, version: current.generation.version, version_hash: current.approval.version_hash, pod_package_id: usesProdigi ? prodigi.sku : 'mpix', page_count: pdfs.pageCount, interior_object_key: interiorKey, cover_object_key: coverKey, interior_md5: createHash('md5').update(pdfs.interior).digest('hex'), cover_md5: createHash('md5').update(pdfs.cover).digest('hex'), cover_width_pt: coverWidth, cover_height_pt: coverHeight, warnings: pdfs.warnings, status: 'validated', updated_at: new Date().toISOString() };
      const { error } = await current.db.from('print_artifacts').upsert(record, { onConflict: 'order_id' });
      if (error) throw new Error('artifact');
      await current.db.from('orders').update({ print_artifact_id: artifactId, status: current.order.status === 'paid' ? 'preflight' : current.order.status, updated_at: new Date().toISOString() }).eq('id', current.order.id);
      return NextResponse.json({ artifact: record, message: `PDF intérieur et couverture prêts pour ${PRINTERS[current.printer].name}.` });
    }

    if (!current.artifact) return NextResponse.json({ error: 'Préparez les PDF avant cette action.' }, { status: 409 });

    if (current.printer === 'mpix') {
      // Mpix has no self-serve API: the team places the order on mpix.com with the PDFs.
      if (parsed.data.action === 'mark-ordered') {
        if (!['paid','preflight'].includes(current.order.status)) return NextResponse.json({ error: 'Le paiement doit être confirmé avant l’impression.' }, { status: 409 });
        await current.db.from('orders').update({ lulu_print_job_id: parsed.data.reference || 'mpix', lulu_status: 'ORDERED_ON_MPIX', status: 'printing', updated_at: new Date().toISOString() }).eq('id', current.order.id);
        await current.db.from('print_artifacts').update({ status: 'submitted', updated_at: new Date().toISOString() }).eq('id', current.artifact.id);
        return NextResponse.json({ message: 'Commande marquée comme passée chez Mpix.' });
      }
      return NextResponse.json({ error: 'Mpix : téléchargez les PDF, commandez sur mpix.com, puis cliquez « Commandé ».' }, { status: 409 });
    }

    const product = await getProdigiProduct(prodigi.sku);
    const printAreas = Object.keys(product.printAreas || { default: {} });
    const urls = await signedPrintUrls(current.db, current.artifact);
    // Interior pages go in "default"; every cover-type area gets the wrap-around cover.
    const assets = printAreas.map((printArea) => /cover|spine/i.test(printArea)
      ? { printArea, url: urls.coverUrl }
      : { printArea, url: urls.interiorUrl, pageCount: current.artifact!.page_count });

    if (parsed.data.action === 'quote') {
      const quote = await getProdigiQuote({ sku: prodigi.sku, copies: current.order.quantity, pageCount: current.artifact.page_count, countryCode, printAreas });
      await current.db.from('print_artifacts').update({ cost_quote: quote, updated_at: new Date().toISOString() }).eq('id', current.artifact.id);
      await current.db.from('orders').update({ lulu_cost_quote: quote, updated_at: new Date().toISOString() }).eq('id', current.order.id);
      const best = quote.quotes?.[0]?.costSummary;
      return NextResponse.json({ quote, message: best ? `Prodigi : livre ${best.items?.amount} ${best.items?.currency} + livraison ${best.shipping?.amount} ${best.shipping?.currency}` : 'Devis reçu.' });
    }

    if (parsed.data.action === 'submit') {
      if (!prodigi.ordersEnabled) return NextResponse.json({ error: 'L’envoi réel à Prodigi est verrouillé (PRODIGI_ORDERS_ENABLED).' }, { status: 423 });
      if (!['paid','preflight'].includes(current.order.status)) return NextResponse.json({ error: 'Le paiement doit être confirmé avant l’impression.' }, { status: 409 });
      const created = await prodigiRequest<{ order?: { id?: string } }>('/orders', { method: 'POST', body: JSON.stringify({
        merchantReference: current.order.order_number,
        idempotencyKey: `${current.order.id}-${current.artifact.version}`,
        shippingMethod: prodigi.shippingMethod,
        recipient: { name: address.name || 'Client Mémoire Maison', email: current.order.customer_email || undefined, phoneNumber: address.phone || undefined, address: { line1: address.street1, line2: address.street2 || null, postalOrZipCode: address.postalCode, countryCode, townOrCity: address.city, stateOrCounty: address.regionCode || null } },
        items: [{ merchantReference: `${current.order.order_number}-BOOK`, sku: prodigi.sku, copies: current.order.quantity, sizing: 'fillPrintArea', assets }],
        metadata: { title: bookTitle(current.generation.result_data) },
      }) });
      const orderId = created.order?.id || null;
      await current.db.from('orders').update({ lulu_print_job_id: orderId, lulu_status: 'InProgress', status: 'printing', updated_at: new Date().toISOString() }).eq('id', current.order.id);
      await current.db.from('print_artifacts').update({ status: 'submitted', updated_at: new Date().toISOString() }).eq('id', current.artifact.id);
      return NextResponse.json({ order: created.order, message: `Commande Prodigi ${orderId} créée (${prodigi.environment === 'live' ? 'réelle' : 'test'}).` });
    }

    if (!current.order.lulu_print_job_id) return NextResponse.json({ error: 'Aucune commande Prodigi à synchroniser.' }, { status: 409 });
    const fetched = await prodigiRequest<{ order?: unknown }>(`/orders/${encodeURIComponent(current.order.lulu_print_job_id)}`);
    const { stage, tracking } = prodigiOrderState(fetched.order);
    const nextStatus = stage === 'Complete' ? 'shipped' : stage === 'Cancelled' ? 'blocked' : 'printing';
    await current.db.from('orders').update({ lulu_status: stage, status: nextStatus, tracking_url: tracking || current.order.tracking_url, updated_at: new Date().toISOString() }).eq('id', current.order.id);
    return NextResponse.json({ order: fetched.order, status: nextStatus, message: `Prodigi : ${stage}` });
  } catch (error) {
    console.error('Print production action failed', error);
    if (error instanceof ProdigiApiError) return NextResponse.json({ error: `Prodigi a refusé la demande (${error.message}).`, details: error.details }, { status: 502 });
    const reason = error instanceof Error ? error.message : 'unknown';
    const messages: Record<string,string> = { approval:'Aucun aperçu approuvé.', version:'Le livre a changé depuis son approbation.', upload:'Stockage des PDF impossible.', artifact:'Dossier de production impossible à enregistrer.', 'signed-files':'Liens des PDF impossibles à créer.' };
    return NextResponse.json({ error: messages[reason] || 'L’action d’impression a échoué sans lancer de commande.' }, { status: 503 });
  }
}

function bookTitle(value: unknown) {
  if (value && typeof value === 'object' && 'title' in value) return String((value as {title:unknown}).title).slice(0, 255);
  return 'Mémoire Maison';
}
