import { NextResponse } from 'next/server';
import { getChatGPTUser } from '../../../../chatgpt-auth';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { memoryUrlForProject, renderProdigiBook, printHash } from '../../../../../lib/prodigi-fulfilment';
import type { GeneratedBook } from '../../../../../lib/book';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=120;
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
  const user=await getChatGPTUser();if(!user)return NextResponse.json({error:'Authentification requise.'},{status:401});
  const {id}=await context.params;const db=createSupabaseAdminClient();if(!db)return NextResponse.json({error:'Service indisponible.'},{status:503});
  const {data:generation}=await db.from('book_generations').select('result_data,version').eq('project_id',id).eq('owner_id',user.userId).order('updated_at',{ascending:false}).limit(1).maybeSingle();
  if(!generation)return NextResponse.json({error:'Livre introuvable.'},{status:404});
  try{
    const book=generation.result_data as GeneratedBook;
    const result=await renderProdigiBook(book,user.userId,await memoryUrlForProject(id,user.userId));
    const {error}=await db.from('site_settings').upsert({key:`print_proof:${user.userId}:${id}`,value:{hash:printHash(book),version:generation.version,renderedAt:new Date().toISOString()},updated_at:new Date().toISOString()},{onConflict:'key'});
    if(error)throw new Error('Validation du fichier indisponible.');
    return new Response(result.pdf as BodyInit,{headers:{'content-type':'application/pdf','content-disposition':'inline; filename="memoire-maison-bon-a-tirer.pdf"','cache-control':'private, no-store'}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Le fichier ne peut pas être préparé.'},{status:422});}
}
