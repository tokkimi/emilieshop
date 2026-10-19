import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminContext, audit, badRequest } from '../../../../lib/admin-api';
import { readSeoSettings, SEO_PAGES, SEO_SETTING } from '../../../../lib/seo';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;
  const settings = await readSeoSettings();
  return NextResponse.json({ pages: SEO_PAGES, settings });
}

const pageSchema = z.object({
  title: z.string().max(70).optional(),
  description: z.string().max(170).optional(),
  noindex: z.boolean().optional(),
});
const putSchema = z.object({
  pages: z.record(z.string(), pageSchema),
  googleVerification: z.string().max(120).regex(/^[A-Za-z0-9_-]*$/).optional(),
});

/** Save the search listings, then refresh the pages so Google sees them. */
export async function PUT(request: Request) {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;
  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Titre (70 caractères max) ou description (170 max) invalide.');
  const known = new Set(SEO_PAGES.map((page) => page.path));
  const pages = Object.fromEntries(Object.entries(parsed.data.pages).filter(([path]) => known.has(path)));
  const value = { pages, googleVerification: parsed.data.googleVerification || undefined };

  const before = await readSeoSettings();
  const { error } = await ctx.db
    .from('site_settings')
    .upsert({ key: SEO_SETTING, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) return badRequest('Enregistrement impossible', 500);
  for (const path of known) revalidatePath(path);
  await audit(ctx, 'seo.update', 'site_settings', SEO_SETTING, { avant: before, après: value });
  return NextResponse.json({ settings: value });
}
