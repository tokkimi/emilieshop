import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  LULU_DEFAULT_POD_PACKAGE_ID,
  LuluApiError,
  luluRequest,
} from '../../../../lib/lulu';

export const dynamic = 'force-dynamic';

const fileSchema = z.object({
  kind: z.enum(['interior', 'cover']),
  sourceUrl: z.string().url().startsWith('https://').max(2048),
  pageCount: z.number().int().min(24).max(800).optional(),
  podPackageId: z.string().min(10).max(80).default(LULU_DEFAULT_POD_PACKAGE_ID),
});

export async function POST(request: Request) {
  try {
    const input = fileSchema.parse(await request.json());
    if (input.kind === 'cover' && !input.pageCount) {
      return NextResponse.json({ error: 'Le nombre de pages est requis pour valider la couverture.' }, { status: 400 });
    }
    const validation = input.kind === 'interior'
      ? await luluRequest('/validate-interior/', {
          method: 'POST',
          body: JSON.stringify({ source_url: input.sourceUrl, pod_package_id: input.podPackageId }),
        })
      : await luluRequest('/validate-cover/', {
          method: 'POST',
          body: JSON.stringify({ source_url: input.sourceUrl, pod_package_id: input.podPackageId, interior_page_count: input.pageCount }),
        });
    return NextResponse.json({ validation }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Fichier ou produit invalide.' }, { status: 400 });
    if (error instanceof LuluApiError) return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
    return NextResponse.json({ error: 'La validation du fichier est momentanément indisponible.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const kind = z.enum(['interior', 'cover']).parse(url.searchParams.get('kind'));
    const id = z.coerce.number().int().positive().parse(url.searchParams.get('id'));
    const validation = await luluRequest(`/${kind === 'interior' ? 'validate-interior' : 'validate-cover'}/${id}/`);
    return NextResponse.json({ validation });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation introuvable.' }, { status: 400 });
    if (error instanceof LuluApiError) return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
    return NextResponse.json({ error: 'Le statut du fichier est momentanément indisponible.' }, { status: 500 });
  }
}
