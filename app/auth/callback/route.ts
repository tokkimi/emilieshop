import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

function safeNext(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/profil';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get('next'));
  const code = url.searchParams.get('code');
  const supabase = await createSupabaseServerClient();
  if (!code || !supabase) {
    return NextResponse.redirect(new URL('/connexion?auth=configuration', url.origin));
  }
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (!error) {
    const { data } = await supabase.auth.getUser();
    if (data.user?.email) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: data.user.email,
        display_name:
          typeof data.user.user_metadata?.full_name === 'string'
            ? data.user.user_metadata.full_name
            : data.user.email.split('@')[0],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    }
  }
  return NextResponse.redirect(new URL(error ? '/connexion?auth=erreur' : next, url.origin));
}
