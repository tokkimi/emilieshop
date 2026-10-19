import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '../../../db';
import { analyticsEvents } from '../../../db/schema';
import { hasSupabasePublicConfig } from '../../../lib/supabase/config';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

const schema = z.object({
  visitorId: z.string().min(1).max(100),
  event: z.string().min(1).max(80),
  path: z.string().min(1).max(300),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|uptime/i;

function device(userAgent: string) {
  if (/ipad|tablet/i.test(userAgent)) return 'tablette';
  if (/mobi|iphone|android/i.test(userAgent)) return 'mobile';
  return 'ordinateur';
}

function referrerHost(value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const host = new URL(value).hostname.replace(/^www\./, '');
    return /(^|\.)memoiremaison\.(com|ca|net|info|store)$/.test(host) ? null : host;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Événement incomplet' }, { status: 400 });
  const userAgent = request.headers.get('user-agent') || '';
  // Robots and link previews are not visitors.
  if (BOT.test(userAgent)) return NextResponse.json({ ok: true, ignored: true });

  const input = parsed.data;
  const metadata = {
    ...(input.metadata || {}),
    referrer: referrerHost(input.metadata?.referrer),
    device: device(userAgent),
    // Vercel geolocates the request; nothing more precise than the region is kept.
    country: request.headers.get('x-vercel-ip-country') || null,
    region: request.headers.get('x-vercel-ip-country-region') || null,
  };

  if (hasSupabasePublicConfig()) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase!.from('analytics_events').insert({
      id: crypto.randomUUID(),
      visitor_id: input.visitorId,
      event_name: input.event,
      path: input.path,
      metadata,
    });
    if (error) return NextResponse.json({ error: 'Événement non enregistré' }, { status: 503 });
    return NextResponse.json({ ok: true }, { status: 201 });
  }
  await getDb().insert(analyticsEvents).values({
    id: crypto.randomUUID(),
    visitorId: input.visitorId,
    eventName: input.event,
    path: input.path,
    metadataJson: JSON.stringify(metadata).slice(0, 4000),
    createdAt: new Date(),
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
