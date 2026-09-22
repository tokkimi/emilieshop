import { NextResponse } from 'next/server';
import { getLuluConfiguration } from '../../../../lib/lulu';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(getLuluConfiguration(), {
    headers: { 'cache-control': 'no-store' },
  });
}
