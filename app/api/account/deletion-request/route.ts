import { NextResponse } from 'next/server';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { hasSupabasePublicConfig } from '../../../../lib/supabase/config';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export async function POST() {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  if (!hasSupabasePublicConfig()) return NextResponse.json({ error: 'Demandes cloud non configurées' }, { status: 503 });
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase!.from('data_requests').select('id,status').eq('user_id', user.userId).eq('request_type', 'deletion').in('status', ['received', 'verified', 'processing']).limit(1).maybeSingle();
  if (existing) return NextResponse.json({ id: existing.id, status: existing.status });
  const { data, error } = await supabase!.from('data_requests').insert({ user_id: user.userId, request_type: 'deletion', status: 'received' }).select('id,status').single();
  if (error) return NextResponse.json({ error: 'La demande n’a pas pu être enregistrée.' }, { status: 503 });
  return NextResponse.json(data, { status: 201 });
}
