import { NextResponse } from 'next/server';
import { adminContext, badRequest } from '../../../../lib/admin-api';

export const dynamic = 'force-dynamic';

/**
 * Site logs in one place: admin actions (audit), Stripe payment
 * notifications, outgoing emails and the latest page visits.
 */
export async function GET(request: Request) {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;
  const limit = Math.min(500, Math.max(20, Number(new URL(request.url).searchParams.get('limit') || 200)));
  const [auditLogs, payments, emails, visits] = await Promise.all([
    ctx.db.from('audit_logs').select('id,action,entity_type,entity_id,details,created_at').order('created_at', { ascending: false }).limit(limit),
    ctx.db.from('stripe_webhook_events').select('id,type,livemode,processed_at').order('processed_at', { ascending: false }).limit(100),
    ctx.db.from('email_outbox').select('id,user_email,template,subject,status,attempts,last_error,created_at,sent_at').order('created_at', { ascending: false }).limit(100),
    ctx.db.from('analytics_events').select('visitor_id,event_name,path,metadata,created_at').order('created_at', { ascending: false }).limit(limit),
  ]);
  if (auditLogs.error) return badRequest('Journal indisponible', 503);
  return NextResponse.json({
    audit: auditLogs.data || [],
    payments: payments.data || [],
    emails: emails.data || [],
    visits: visits.data || [],
  });
}
