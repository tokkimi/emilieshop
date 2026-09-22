import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  LULU_DEFAULT_POD_PACKAGE_ID,
  LuluApiError,
  luluRequest,
} from '../../../../lib/lulu';

export const dynamic = 'force-dynamic';

const schema = z.object({
  pageCount: z.number().int().min(24).max(800),
  podPackageId: z.string().min(10).max(80).default(LULU_DEFAULT_POD_PACKAGE_ID),
  unit: z.enum(['pt', 'mm', 'inch']).default('mm'),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const dimensions = await luluRequest('/cover-dimensions/', {
      method: 'POST',
      body: JSON.stringify({
        pod_package_id: input.podPackageId,
        interior_page_count: input.pageCount,
        unit: input.unit,
      }),
    });
    return NextResponse.json({ dimensions }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Produit ou pagination invalide.' }, { status: 400 });
    if (error instanceof LuluApiError) return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
    return NextResponse.json({ error: 'Le calcul de couverture est momentanément indisponible.' }, { status: 500 });
  }
}
