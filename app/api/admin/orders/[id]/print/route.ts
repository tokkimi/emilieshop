import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getChatGPTUser } from '../../../../../chatgpt-auth';
import { isAdminUser } from '../../../../../../lib/admin-auth';
import { ensureCompleteBook, type GeneratedBook } from '../../../../../../lib/book';
import { getLuluConfiguration, luluRequest } from '../../../../../../lib/lulu';
import { buildPrintPdfs } from '../../../../../../lib/print-pdf';
import { supabaseMediaBucket } from '../../../../../../lib/supabase/config';
import { createSupabaseAdminClient } from '../../../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const actionSchema = z.object({ action: z.enum(['prepare', 'validate', 'refresh-validation', 'quote', 'submit', 'sync']) });
type Address = { name?: string; street1?: string; street2?: string; city?: string; regionCode?: string; countryCode?: string; postalCode?: string; phone?: string };
type Artifact = { id:string; order_id:string; project_id:string; owner_id:string; generation_id:string; approval_id:string; version:number; version_hash:string; pod_package_id:string; page_count:number; interior_object_key:string; cover_object_key:string; interior_md5:string; cover_md5:string; cover_width_pt:number; cover_height_pt:number; warnings:unknown[]; interior_validation_id:string|null; cover_validation_id:string|null; interior_validation_status:string|null; cover_validation_status:string|null; cost_quote:unknown; status:string };

async function authorize() {
  const user = await getChatGPTUser();
  return user && isAdminUser(user) ? user : null;
}

function validationStatus(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  return String(candidate.status || candidate.validation_status || '').toUpperCase() || null;
}

function readId(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  return candidate.id === undefined || candidate.id === null ? null : String(candidate.id);
}

function printJobStatus(value: Record<string, unknown>) {
  const nested = value.status && typeof value.status === 'object' ? value.status as Record<string, unknown> : null;
  return String(nested?.name || value.status_name || value.status || 'UNKNOWN').toUpperCase();
}

function printJobTrackingUrl(value: Record<string, unknown>) {
  if (typeof value.tracking_url === 'string') return value.tracking_url;
  const statuses = Array.isArray(value.line_item_statuses) ? value.line_item_statuses : [];
  for (const item of statuses) {
    if (!item || typeof item !== 'object') continue;
    const messages = (item as Record<string, unknown>).messages;
    if (!messages || typeof messages !== 'object') continue;
    const urls = (messages as Record<string, unknown>).tracking_urls;
    if (Array.isArray(urls) && typeof urls[0] === 'string') return urls[0];
  }
  return null;
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
  return { db, order, generation, approval, artifact: artifact as Artifact | null };
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await authorize()) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  try {
    const { id } = await context.params;
    const { order, artifact } = await contextForOrder(id);
    const file = new URL(request.url).searchParams.get('file');
    if ((file === 'interior' || file === 'cover') && artifact) {
      const key = file === 'interior' ? artifact.interior_object_key : artifact.cover_object_key;
      const db = createSupabaseAdminClient();
      const { data } = await db!.storage.from(supabaseMediaBucket).createSignedUrl(key, 10 * 60, { download: `${order.order_number}-${file}.pdf` });
      if (!data?.signedUrl) return NextResponse.json({ error: 'Fichier indisponible.' }, { status: 404 });
      return NextResponse.redirect(data.signedUrl);
    }
    return NextResponse.json({ order: { id: order.id, status: order.status, luluPrintJobId: order.lulu_print_job_id, luluStatus: order.lulu_status, trackingUrl: order.tracking_url }, artifact, configuration: getLuluConfiguration() });
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
    const configuration = getLuluConfiguration();
    if (!configuration.configured) return NextResponse.json({ error: 'Ajoutez les clés Lulu Print API dans Vercel.' }, { status: 503 });

    if (parsed.data.action === 'prepare') {
      const book = ensureCompleteBook(current.generation.result_data as GeneratedBook);
      const dimensions = await luluRequest<{ width:string; height:string; unit:string }>('/cover-dimensions/', { method: 'POST', body: JSON.stringify({ pod_package_id: configuration.product.podPackageId, interior_page_count: 24, unit: 'pt' }) });
      const coverWidth = Number(dimensions.width); const coverHeight = Number(dimensions.height);
      if (!Number.isFinite(coverWidth) || !Number.isFinite(coverHeight)) throw new Error('dimensions');
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
      const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://emilieshop.vercel.app';
      const pdfs = await buildPrintPdfs({ book, coverWidth, coverHeight, memoryUrl: `${origin}/memory/${memoryLink!.slug}`, loadMedia });
      const artifactId = current.artifact?.id || crypto.randomUUID();
      const baseKey = `${current.order.owner_id}/${current.order.project_id}/print/${current.order.id}/${current.generation.version}`;
      const interiorKey = `${baseKey}/interior.pdf`; const coverKey = `${baseKey}/cover.pdf`;
      const [interiorUpload, coverUpload] = await Promise.all([
        current.db.storage.from(supabaseMediaBucket).upload(interiorKey, pdfs.interior, { contentType: 'application/pdf', upsert: true }),
        current.db.storage.from(supabaseMediaBucket).upload(coverKey, pdfs.cover, { contentType: 'application/pdf', upsert: true }),
      ]);
      if (interiorUpload.error || coverUpload.error) throw new Error('upload');
      const record = { id: artifactId, order_id: current.order.id, project_id: current.order.project_id, owner_id: current.order.owner_id, generation_id: current.generation.id, approval_id: current.approval.id, version: current.generation.version, version_hash: current.approval.version_hash, pod_package_id: configuration.product.podPackageId, page_count: pdfs.pageCount, interior_object_key: interiorKey, cover_object_key: coverKey, interior_md5: createHash('md5').update(pdfs.interior).digest('hex'), cover_md5: createHash('md5').update(pdfs.cover).digest('hex'), cover_width_pt: coverWidth, cover_height_pt: coverHeight, warnings: pdfs.warnings, status: 'prepared', updated_at: new Date().toISOString() };
      const { error } = await current.db.from('print_artifacts').upsert(record, { onConflict: 'order_id' });
      if (error) throw new Error('artifact');
      await current.db.from('orders').update({ print_artifact_id: artifactId, status: current.order.status === 'paid' ? 'preflight' : current.order.status, updated_at: new Date().toISOString() }).eq('id', current.order.id);
      return NextResponse.json({ artifact: record, message: 'PDF intérieur et couverture préparés.' });
    }

    if (!current.artifact) return NextResponse.json({ error: 'Préparez les fichiers avant cette action.' }, { status: 409 });
    const urls = await signedPrintUrls(current.db, current.artifact);

    if (parsed.data.action === 'validate') {
      const [interior, cover] = await Promise.all([
        luluRequest<unknown>('/validate-interior/', { method: 'POST', body: JSON.stringify({ source_url: urls.interiorUrl, pod_package_id: current.artifact.pod_package_id }) }),
        luluRequest<unknown>('/validate-cover/', { method: 'POST', body: JSON.stringify({ source_url: urls.coverUrl, pod_package_id: current.artifact.pod_package_id, interior_page_count: current.artifact.page_count }) }),
      ]);
      await current.db.from('print_artifacts').update({ interior_validation_id: readId(interior), cover_validation_id: readId(cover), interior_validation_status: validationStatus(interior), cover_validation_status: validationStatus(cover), status: 'validating', updated_at: new Date().toISOString() }).eq('id', current.artifact.id);
      return NextResponse.json({ interior, cover, message: 'Validation Lulu lancée.' });
    }

    if (parsed.data.action === 'refresh-validation') {
      if (!current.artifact.interior_validation_id || !current.artifact.cover_validation_id) return NextResponse.json({ error: 'Aucune validation en cours.' }, { status: 409 });
      const [interior, cover] = await Promise.all([
        luluRequest<unknown>(`/validate-interior/${current.artifact.interior_validation_id}/`),
        luluRequest<unknown>(`/validate-cover/${current.artifact.cover_validation_id}/`),
      ]);
      const interiorStatus = validationStatus(interior); const coverStatus = validationStatus(cover);
      const successful = ['VALIDATED','NORMALIZED'].includes(interiorStatus || '') && ['VALIDATED','NORMALIZED'].includes(coverStatus || '');
      const failed = interiorStatus === 'ERROR' || coverStatus === 'ERROR';
      await current.db.from('print_artifacts').update({ interior_validation_status: interiorStatus, cover_validation_status: coverStatus, status: successful ? 'validated' : failed ? 'failed' : 'validating', updated_at: new Date().toISOString() }).eq('id', current.artifact.id);
      return NextResponse.json({ interior, cover, ready: successful });
    }

    const address = current.order.shipping_address as Address;
    if (parsed.data.action === 'quote') {
      const quote = await luluRequest<unknown>('/print-job-cost-calculations/', { method: 'POST', body: JSON.stringify({ line_items: [{ quantity: current.order.quantity, page_count: current.artifact.page_count, pod_package_id: current.artifact.pod_package_id }], shipping_option: 'MAIL', shipping_address: { name: address.name, street1: address.street1, street2: address.street2, city: address.city, state_code: address.regionCode, country_code: address.countryCode, postcode: address.postalCode, phone_number: address.phone, email: current.order.customer_email } }) });
      await current.db.from('print_artifacts').update({ cost_quote: quote, updated_at: new Date().toISOString() }).eq('id', current.artifact.id);
      await current.db.from('orders').update({ lulu_cost_quote: quote, updated_at: new Date().toISOString() }).eq('id', current.order.id);
      return NextResponse.json({ quote });
    }

    if (parsed.data.action === 'submit') {
      if (!configuration.ordersEnabled) return NextResponse.json({ error: 'L’envoi réel Lulu est verrouillé.' }, { status: 423 });
      if (!['paid','preflight'].includes(current.order.status)) return NextResponse.json({ error: 'Le paiement doit être confirmé avant l’impression.' }, { status: 409 });
      if (current.artifact.status !== 'validated') return NextResponse.json({ error: 'Les deux PDF doivent être validés par Lulu.' }, { status: 409 });
      const printJob = await luluRequest<unknown>('/print-jobs/', { method: 'POST', body: JSON.stringify({ external_id: current.order.order_number, contact_email: process.env.LULU_CONTACT_EMAIL || 'emilie@equipecauvier.com', shipping_level: 'MAIL', shipping_address: { name: address.name, street1: address.street1, street2: address.street2, city: address.city, state_code: address.regionCode, country_code: address.countryCode, postcode: address.postalCode, phone_number: address.phone, email: current.order.customer_email }, line_items: [{ external_id: `${current.order.order_number}-BOOK`, title: bookTitle(current.generation.result_data), quantity: current.order.quantity, pod_package_id: current.artifact.pod_package_id, interior: { source_url: urls.interiorUrl, source_md5sum: current.artifact.interior_md5 }, cover: { source_url: urls.coverUrl, source_md5sum: current.artifact.cover_md5 } }] }) });
      const printJobId = readId(printJob);
      await current.db.from('orders').update({ lulu_print_job_id: printJobId, lulu_status: 'CREATED', status: 'printing', updated_at: new Date().toISOString() }).eq('id', current.order.id);
      await current.db.from('print_artifacts').update({ status: 'submitted', updated_at: new Date().toISOString() }).eq('id', current.artifact.id);
      return NextResponse.json({ printJob });
    }

    if (!current.order.lulu_print_job_id) return NextResponse.json({ error: 'Aucun travail Lulu à synchroniser.' }, { status: 409 });
    const printJob = await luluRequest<Record<string, unknown>>(`/print-jobs/${current.order.lulu_print_job_id}/`);
    const luluStatus = printJobStatus(printJob);
    const nextStatus = /SHIPPED/.test(luluStatus) ? 'shipped' : /DELIVERED/.test(luluStatus) ? 'delivered' : /REJECT|CANCEL|ERROR/.test(luluStatus) ? 'blocked' : 'printing';
    const tracking = printJobTrackingUrl(printJob);
    await current.db.from('orders').update({ lulu_status: luluStatus, status: nextStatus, tracking_url: tracking || current.order.tracking_url, updated_at: new Date().toISOString() }).eq('id', current.order.id);
    return NextResponse.json({ printJob, status: nextStatus });
  } catch (error) {
    console.error('Print production action failed', error);
    const reason = error instanceof Error ? error.message : 'unknown';
    const messages: Record<string,string> = { approval:'Aucun aperçu approuvé.', version:'Le livre a changé depuis son approbation.', dimensions:'Dimensions de couverture Lulu invalides.', upload:'Stockage des PDF impossible.', artifact:'Dossier de production impossible à enregistrer.' };
    return NextResponse.json({ error: messages[reason] || 'L’action d’impression a échoué sans lancer de commande.' }, { status: 503 });
  }
}

function bookTitle(value: unknown) {
  if (value && typeof value === 'object' && 'title' in value) return String((value as {title:unknown}).title).slice(0, 255);
  return 'Mémoire Maison';
}
