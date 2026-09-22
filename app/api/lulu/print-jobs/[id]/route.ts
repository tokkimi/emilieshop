import { NextResponse } from 'next/server';
import { LuluApiError, isTrustedProductionRequest, luluRequest } from '../../../../../lib/lulu';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isTrustedProductionRequest(request)) {
    return NextResponse.json({ error: 'Suivi de production non autorisé.' }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    if (!/^[a-zA-Z0-9-]{1,100}$/.test(id)) return NextResponse.json({ error: 'Commande invalide.' }, { status: 400 });
    const printJob = await luluRequest(`/print-jobs/${id}/`);
    return NextResponse.json({ printJob });
  } catch (error) {
    if (error instanceof LuluApiError) return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
    return NextResponse.json({ error: 'Le suivi d’impression est momentanément indisponible.' }, { status: 500 });
  }
}
