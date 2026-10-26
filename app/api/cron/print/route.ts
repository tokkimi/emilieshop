import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { fulfilProdigiOrder, snapshotFromItems, syncProdigiOrder } from '../../../../lib/prodigi-fulfilment';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;const supplied=request.headers.get('authorization')||'';const expected=`Bearer ${secret}`;
 if(!secret||supplied.length!==expected.length||!timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return NextResponse.json({error:'Accès refusé.'},{status:403});
 const db=createSupabaseAdminClient();if(!db)return NextResponse.json({error:'Service indisponible.'},{status:503});
 const {data:orders,error}=await db.from('orders').select('id,items,status,updated_at').in('status',['paid','preflight','printing']).eq('payment_status','paid').order('updated_at',{ascending:true}).limit(15);
 if(error)return NextResponse.json({error:'File indisponible.'},{status:503});
 let processed=0,failed=0;
 for(const order of orders||[]){if(snapshotFromItems(order.items)?.printer!=='prodigi')continue;try{if(order.status==='printing')await syncProdigiOrder(order.id);else await fulfilProdigiOrder(order.id);processed++;}catch{failed++;}}
 return NextResponse.json({processed,failed});
}
