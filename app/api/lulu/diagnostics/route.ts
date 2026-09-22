import { NextResponse } from 'next/server';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { isAdminUser } from '../../../../lib/admin-auth';
import {
  isTrustedDiagnosticsRequest,
  isTrustedProductionRequest,
  verifyLuluConnection,
} from '../../../../lib/lulu';

export const dynamic = 'force-dynamic';

async function isAuthorized(request: Request): Promise<boolean> {
  if (isTrustedDiagnosticsRequest(request) || isTrustedProductionRequest(request)) return true;
  const user = await getChatGPTUser();
  return Boolean(user && isAdminUser(user));
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json(
      { error: 'Accès refusé' },
      { status: 403, headers: { 'cache-control': 'no-store' } },
    );
  }

  const classify = ['1', 'true'].includes(
    new URL(request.url).searchParams.get('classify') || '',
  );
  const result = await verifyLuluConnection({ classify });
  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
}
