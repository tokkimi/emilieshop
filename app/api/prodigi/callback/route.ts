import { NextResponse, after } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { syncProdigiOrder } from '../../../../lib/prodigi-fulfilment';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
export async function POST(request:Request){
 if(Number(request.headers.get('content-length')||0)>500000)return new Response(null,{status:413});
 const payload=await request.json().catch(()=>null) as {data?:{order?:{id?:string}}}|null;const id=payload?.data?.order?.id;
 if(typeof id!=='string'||!/^ord_[A-Za-z0-9_-]+$/.test(id))return NextResponse.json({received:true});
 const db=createSupabaseAdminClient();const {data:order}=db?await db.from('orders').select('id').eq('lulu_print_job_id',id).maybeSingle():{data:null};
 // Never trust callback status, address or amounts: authenticate with Prodigi and re-fetch.
 if(order)after(async()=>{try{await syncProdigiOrder(order.id);}catch{console.error('Prodigi status refresh pending');}});
 return NextResponse.json({received:true});
}
