import { createHash, randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { PDFDocument, rgb } from 'pdf-lib';
import { MEMOIRE_LOGO_PNG_BASE64 } from './brand-logo';
import { bookApprovalSource, type GeneratedBook } from './book';
import { buildProdigiPrintPdf } from './print-pdf';
import { getProdigiConfiguration, getProdigiQuote, getProdigiSpineMm, prodigiRequest, prodigiOrderState } from './prodigi';
import { createSupabaseAdminClient } from './supabase/server';
import { supabaseMediaBucket } from './supabase/config';

export type PrintSnapshot = { type:'print_snapshot'; printer:'prodigi'|'mpix'; book:GeneratedBook; hash:string; approvalId:string; renderer:'prodigi-a4-v1' };
export function printHash(book: GeneratedBook) { return createHash('sha256').update(bookApprovalSource(book)).digest('hex'); }
export function snapshotFromItems(items: unknown): PrintSnapshot | null { return Array.isArray(items) ? items.find((item)=>item?.type==='print_snapshot'&&item.renderer==='prodigi-a4-v1') || null : null; }

export async function renderProdigiBook(book: GeneratedBook, ownerId: string, memoryUrl: string) {
  const db=createSupabaseAdminClient();if(!db)throw new Error('Base indisponible.');
  const loadMedia=async(item:{id:string})=>{
    const {data:row}=await db.from('media').select('object_key,content_type').eq('id',item.id).eq('owner_id',ownerId).eq('project_id',book.projectId).maybeSingle();
    if(!row)return null;
    const {data}=await db.storage.from(supabaseMediaBucket).download(row.object_key);if(!data)return null;
    try { const bytes=await sharp(Buffer.from(await data.arrayBuffer()),{limitInputPixels:80_000_000}).rotate().resize({width:4000,height:5000,fit:"inside",withoutEnlargement:true}).png().toBuffer();return{bytes:new Uint8Array(bytes),contentType:'image/png'}; } catch{return null;}
  };
  return buildProdigiPrintPdf({book,logoPng:Uint8Array.from(Buffer.from(MEMOIRE_LOGO_PNG_BASE64,'base64')),memoryUrl,loadMedia});
}

export async function memoryUrlForProject(projectId:string,ownerId:string) {
  const db=createSupabaseAdminClient();if(!db)throw new Error('Base indisponible.');
  let {data:link}=await db.from('memory_links').select('slug').eq('project_id',projectId).eq('owner_id',ownerId).maybeSingle();
  if(!link){const result=await db.from('memory_links').insert({project_id:projectId,owner_id:ownerId,slug:randomBytes(18).toString('base64url'),status:'private'}).select('slug').single();if(result.error)throw new Error('Memory Link indisponible.');link=result.data;}
  return `https://memoiremaison.com/m/${link!.slug}`;
}

export async function fulfilProdigiOrder(orderId: string) {
  const db=createSupabaseAdminClient();if(!db)throw new Error('Base indisponible.');
  const {data:order}=await db.from('orders').select('*').eq('id',orderId).maybeSingle();
  if(!order||order.payment_status!=='paid'||!['paid','preflight'].includes(order.status))return{skipped:true};
  const snapshot=snapshotFromItems(order.items);
  if(!snapshot||snapshot.printer!=='prodigi'||order.lulu_print_job_id)return{skipped:true};
  const config=getProdigiConfiguration();
  if(config.sku!=='BOOK-FE-A4-P-HARD-G')throw new Error('Le gabarit de ce produit n’a pas été validé.');
  if(!config.ordersEnabled)return{paused:true};
  // An atomic compare-and-swap claims this order. A stale claim can be retried by cron.
  if(order.status==='preflight'&&Date.now()-new Date(order.updated_at).getTime()<5*60*1000)return{busy:true};
  const {data:claimed,error:claimError}=await db.from('orders').update({status:'preflight',updated_at:new Date().toISOString()}).eq('id',orderId).eq('status',order.status).eq('updated_at',order.updated_at).select('id').maybeSingle();
  if(claimError)throw new Error('Impossible de réserver la commande.');if(!claimed)return{busy:true};
  try {
    if(snapshot.hash!==printHash(snapshot.book))throw new Error('La version de fabrication ne correspond pas au livre approuvé.');
    const address=order.shipping_address;
    if(!address?.name||!address?.street1||!address?.city||!address?.postalCode||!address?.countryCode)throw new Error('Adresse de livraison incomplète.');
    const memoryUrl=await memoryUrlForProject(order.project_id,order.owner_id);
    const files=await renderProdigiBook(snapshot.book,order.owner_id,memoryUrl);
    const spineMm=await getProdigiSpineMm(config.sku,files.pageCount,address.countryCode,address.regionCode);
    if(!spineMm)throw new Error('Prodigi ne confirme pas la largeur de tranche.');
    const quote=await getProdigiQuote({sku:config.sku,copies:order.quantity,pageCount:files.pageCount,countryCode:address.countryCode,currencyCode:'USD',printAreas:['default']});
    const cost=quote.quotes?.[0]?.costSummary;
    const usd=Number(cost?.totalCost?.amount);
    const conservativeCadPerUsd=Number(process.env.PRODIGI_CAD_PER_USD_BUDGET||2);
    const budget=(Number(order.subtotal_cents)+Number(order.shipping_cents))/100*.55/conservativeCadPerUsd;
    if(cost?.totalCost?.currency!=='USD'||!Number.isFinite(usd)||usd<=0||usd>budget)throw new Error('Le coût fournisseur dépasse le budget de marge. Vérification nécessaire.');
    const spineDocument=await PDFDocument.create();const spine=spineDocument.addPage([spineMm/25.4*72,files.height]);spine.drawRectangle({x:0,y:0,width:spine.getWidth(),height:spine.getHeight(),color:rgb(.114,.161,.255)});const spineBytes=await spineDocument.save();
    const base=`${order.owner_id}/${order.project_id}/print/${order.id}/${snapshot.hash}`;
    const pdfKey=`${base}/book.pdf`,spineKey=`${base}/spine.pdf`;
    for(const [key,bytes] of [[pdfKey,files.pdf],[spineKey,spineBytes]] as const){const {error}=await db.storage.from(supabaseMediaBucket).upload(key,bytes,{contentType:'application/pdf',upsert:true});if(error)throw new Error('Stockage des fichiers d’impression indisponible.');}
    const record={order_id:order.id,project_id:order.project_id,owner_id:order.owner_id,generation_id:snapshot.book.id,approval_id:snapshot.approvalId,version:snapshot.book.version,version_hash:snapshot.hash,pod_package_id:config.sku,page_count:files.pageCount,interior_object_key:pdfKey,cover_object_key:spineKey,interior_md5:createHash('md5').update(files.pdf).digest('hex'),cover_md5:createHash('md5').update(spineBytes).digest('hex'),cover_width_pt:files.width,cover_height_pt:files.height,warnings:files.warnings,cost_quote:quote,status:'validated',updated_at:new Date().toISOString()};
    const {data:artifact,error:artifactError}=await db.from('print_artifacts').upsert(record,{onConflict:'order_id'}).select('id').single();if(artifactError)throw new Error('Enregistrement du contrôle d’impression impossible.');
    const signed=await Promise.all([pdfKey,spineKey].map(async(key)=>{const {data,error}=await db.storage.from(supabaseMediaBucket).createSignedUrl(key,7*86400);if(error||!data)throw new Error('Fichiers privés indisponibles.');return data.signedUrl;}));
    const created=await prodigiRequest<{order?:{id?:string}}>('/orders',{method:'POST',body:JSON.stringify({merchantReference:order.order_number,idempotencyKey:`mm-${order.id}-${snapshot.hash.slice(0,16)}`,shippingMethod:config.shippingMethod,callbackUrl:'https://memoiremaison.com/api/prodigi/callback',recipient:{name:address.name,email:order.customer_email,phoneNumber:address.phone,address:{line1:address.street1,line2:address.street2||null,postalOrZipCode:address.postalCode,countryCode:address.countryCode,townOrCity:address.city,stateOrCounty:address.regionCode||null}},items:[{merchantReference:order.order_number,sku:config.sku,copies:order.quantity,sizing:'fitPrintArea',assets:[{printArea:'default',url:signed[0],pageCount:files.pageCount},{printArea:'spine',url:signed[1]}]}],metadata:{orderId:order.id,versionHash:snapshot.hash}})});
    if(!created.order?.id)throw new Error('Prodigi n’a pas confirmé le numéro de commande.');
    const {error:saveError}=await db.from('orders').update({lulu_print_job_id:created.order.id,lulu_status:'InProgress',lulu_cost_quote:quote,print_artifact_id:artifact.id,status:'printing',updated_at:new Date().toISOString()}).eq('id',order.id);if(saveError)throw new Error('Synchronisation de la commande fournisseur à reprendre.');
    await db.from('print_artifacts').update({status:'submitted',updated_at:new Date().toISOString()}).eq('id',artifact.id);
    return{submitted:true};
  } catch(error) {
    const message=error instanceof Error?error.message:'Erreur de fabrication.';
    await db.from('orders').update({lulu_status:`ATTENTION: ${message.slice(0,220)}`,updated_at:new Date().toISOString()}).eq('id',order.id);
    throw error;
  }
}

export async function syncProdigiOrder(orderId:string) {
  const db=createSupabaseAdminClient();if(!db)return;
  const {data:order}=await db.from('orders').select('id,items,lulu_print_job_id,status,tracking_url').eq('id',orderId).maybeSingle();
  if(!order?.lulu_print_job_id||snapshotFromItems(order.items)?.printer!=='prodigi')return;
  const response=await prodigiRequest<{order:unknown}>(`/orders/${encodeURIComponent(order.lulu_print_job_id)}`);
  const {stage,tracking}=prodigiOrderState(response.order);
  await db.from('orders').update({lulu_status:stage,tracking_url:tracking||order.tracking_url,status:stage==='Complete'?'shipped':stage==='Cancelled'?'blocked':order.status,updated_at:new Date().toISOString()}).eq('id',order.id);
}
