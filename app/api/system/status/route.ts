import { NextResponse } from 'next/server';
import { getLuluConfiguration } from '../../../../lib/lulu';
import { hasSupabaseAdminConfig, hasSupabasePublicConfig } from '../../../../lib/supabase/config';

export const dynamic = 'force-dynamic';

export function GET() {
  const lulu = getLuluConfiguration();
  return NextResponse.json({
    database: hasSupabasePublicConfig(),
    privateStorage: hasSupabasePublicConfig(),
    authentication: hasSupabasePublicConfig(),
    serverAdministration: hasSupabaseAdminConfig(),
    lulu: lulu.configured,
    luluOrders: lulu.ordersEnabled,
    payments: Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    transactionalEmail: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    bookComposition: Boolean(process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
  }, { headers: { 'cache-control': 'no-store' } });
}
