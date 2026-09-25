import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getChatGPTUser } from '../../chatgpt-auth';
import { assertSustainablePrice, calculateCatalogSubtotal, estimateShippingCents, formatCad, getPlan } from '../../../lib/catalog';
import { estimateTax } from '../../../lib/tax';
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../lib/supabase/server';
import { queueAndSendOrderEmail } from '../../../lib/transactional-email';
import { createCheckoutSession } from '../../../lib/stripe';

export const dynamic='force-dynamic';
const schema=z.object({projectId:z.string().uuid(),planId:z.enum(['essential','keepsake','family']),addOnIds:z.array(z.enum(['extra-copy','mini-film','memory-link','digital-frame'])).max(8).default([]),locale:z.enum(['fr','en']).default('fr'),shippingAddress:z.object({name:z.string().min(2).max(120),street1:z.string().min(3).max(150),street2:z.string().max(150).optional(),city:z.string().min(2).max(100),regionCode:z.string().min(2).max(3),countryCode:z.string().length(2),postalCode:z.string().min(3).max(20),phone:z.string().min(8).max(25)})});

export async function GET(){
  const user=await getChatGPTUser();if(!user)return NextResponse.json({error:'Authentification requise'},{status:401});
  const supabase=await createSupabaseServerClient();if(!supabase)return NextResponse.json({error:'Service indisponible'},{status:503});
  const {data,error}=await supabase.from('orders').select('*').eq('owner_id',user.userId).order('created_at',{ascending:false});
  if(error)return NextResponse.json({error:'Commandes indisponibles'},{status:503});
  return NextResponse.json({orders:data||[]});
}

export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return NextResponse.json({error:'Créez ou ouvrez votre compte avant de commander.'},{status:401});
  const parsed=schema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:'Les informations de commande sont incomplètes.'},{status:400});
  const input=parsed.data;const admin=createSupabaseAdminClient();if(!admin)return NextResponse.json({error:'Service de commande indisponible.'},{status:503});
  const {data:project}=await admin.from('projects').select('id,title,status').eq('id',input.projectId).eq('owner_id',user.userId).maybeSingle();
  if(!project)return NextResponse.json({error:'Projet introuvable.'},{status:404});
  const {data:approval}=await admin.from('approvals').select('approved_at,version').eq('project_id',input.projectId).eq('owner_id',user.userId).order('approved_at',{ascending:false}).limit(1).maybeSingle();
  if(!approval)return NextResponse.json({error:'L’aperçu doit être approuvé avant la commande.'},{status:409});
  const {data:generation}=await admin.from('book_generations').select('version').eq('project_id',input.projectId).eq('owner_id',user.userId).order('updated_at',{ascending:false}).limit(1).maybeSingle();
  if(!generation||generation.version!==approval.version)return NextResponse.json({error:'Le livre a été modifié depuis la validation. Approuvez la nouvelle version.'},{status:409});
  const subtotalCents=calculateCatalogSubtotal(input.planId,input.addOnIds);assertSustainablePrice(input.planId,subtotalCents);
  const shippingCents=estimateShippingCents(input.shippingAddress.countryCode);
  const tax=estimateTax(subtotalCents+shippingCents,input.shippingAddress.countryCode,input.shippingAddress.regionCode);
  const taxCents=tax.taxCents||0;const totalCents=subtotalCents+shippingCents+taxCents;const plan=getPlan(input.planId);
  const id=crypto.randomUUID();const orderNumber=`MM-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${crypto.randomUUID().slice(0,4).toUpperCase()}`;
  const items=[{type:'book',code:plan.id,label:plan.name[input.locale],quantity:plan.copies,unitPriceCents:plan.priceCents},{type:'addons',codes:input.addOnIds}];
  const {error}=await admin.from('orders').insert({id,order_number:orderNumber,project_id:input.projectId,owner_id:user.userId,status:'awaiting_payment',total_cents:totalCents,currency:'CAD',quantity:plan.copies,shipping_address:input.shippingAddress,print_approved_at:approval.approved_at,locale:input.locale,product_code:plan.id,unit_price_cents:plan.priceCents,subtotal_cents:subtotalCents,shipping_cents:shippingCents,tax_cents:taxCents,tax_rate_bps:tax.rateBps,tax_jurisdiction:`${input.shippingAddress.countryCode}-${input.shippingAddress.regionCode}`,items,customer_email:user.email,confirmation_email_status:'queued'});
  if(error)return NextResponse.json({error:'La commande n’a pas pu être enregistrée.'},{status:503});
  const email=await queueAndSendOrderEmail({orderId:id,orderNumber,email:user.email,name:input.shippingAddress.name,total:formatCad(totalCents,input.locale),locale:input.locale});
  await admin.from('orders').update({confirmation_email_status:email.status}).eq('id',id);
  const origin=process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/,'')||new URL(request.url).origin;
  let checkoutUrl:string|null=null;
  try{const session=await createCheckoutSession({orderId:id,orderNumber,totalCents,currency:'CAD',email:user.email,locale:input.locale,label:plan.name[input.locale],origin});checkoutUrl=session?.url||null;}catch{checkoutUrl=null;}
  return NextResponse.json({order:{id,orderNumber,totalCents,status:'awaiting_payment'},emailStatus:email.status,checkoutUrl},{status:201});
}
