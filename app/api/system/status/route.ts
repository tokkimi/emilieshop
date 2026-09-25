import { NextResponse } from 'next/server';
import { getLuluConfiguration } from '../../../../lib/lulu';
import { hasSupabaseAdminConfig, hasSupabasePublicConfig } from '../../../../lib/supabase/config';
import { getStripeConfiguration } from '../../../../lib/stripe';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const lulu = getLuluConfiguration();
  const stripe = getStripeConfiguration();
  const admin = createSupabaseAdminClient();
  let serverAdministration = false;
  if (admin) {
    const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    serverAdministration = !error;
  }
  return NextResponse.json({
    database: hasSupabasePublicConfig(),
    privateStorage: hasSupabasePublicConfig(),
    authentication: hasSupabasePublicConfig(),
    serverAdministration,
    serverAdministrationConfigured: hasSupabaseAdminConfig(),
    lulu: lulu.configured,
    luluOrders: lulu.ordersEnabled,
    payments: stripe.configured,
    stripe,
    transactionalEmail: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    bookComposition: Boolean(process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
  }, { headers: { 'cache-control': 'no-store' } });
}
