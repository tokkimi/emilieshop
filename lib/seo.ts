import type { Metadata } from 'next';
import { createSupabaseAdminClient } from './supabase/server';

/** site_settings key holding what the admin set in the SEO section. */
export const SEO_SETTING = 'seo';

export type SeoPage = { title: string; description: string; noindex?: boolean };
export type SeoSettings = { pages: Record<string, Partial<SeoPage>>; googleVerification?: string };

/** The public pages whose search listing can be edited from the admin, with their defaults. */
export const SEO_PAGES: Array<{ path: string; label: string; defaults: SeoPage }> = [
  {
    path: '/',
    label: 'Accueil (français)',
    defaults: {
      title: 'Mémoire Maison — Chaque maison a une histoire',
      description: 'Créez un livre souvenir personnalisé de votre maison, à partir de vos photos, de vos mots et de votre voix.',
    },
  },
  {
    path: '/en',
    label: 'Accueil (anglais)',
    defaults: {
      title: 'Mémoire Maison — Every home has a story',
      description: 'Create a personalized home memory book from your photos, words and voice.',
    },
  },
  {
    path: '/professionnels',
    label: 'Professionnels (français)',
    defaults: {
      title: 'Cadeau de clôture pour courtiers — Mémoire Maison',
      description: 'Offrez à vos vendeurs un livre souvenir personnalisé de leur maison, créé et livré avec un suivi professionnel.',
    },
  },
  {
    path: '/en/professionals',
    label: 'Professionnels (anglais)',
    defaults: {
      title: 'Closing gifts for realtors — Mémoire Maison',
      description: 'Offer sellers a personalized memory book of their home with a simple professional workflow.',
    },
  },
];

export async function readSeoSettings(): Promise<SeoSettings> {
  const db = createSupabaseAdminClient();
  if (!db) return { pages: {} };
  const { data } = await db.from('site_settings').select('value').eq('key', SEO_SETTING).maybeSingle();
  const value = (data?.value || {}) as Partial<SeoSettings>;
  return { pages: value.pages || {}, googleVerification: value.googleVerification };
}

/**
 * Metadata for an editable page: the admin's title and description when set,
 * the built-in ones otherwise. Never fails a page render over a settings read.
 */
export async function seoMetadata(path: string, base: Metadata = {}): Promise<Metadata> {
  const page = SEO_PAGES.find((item) => item.path === path);
  if (!page) return base;
  let settings: SeoSettings = { pages: {} };
  try {
    settings = await readSeoSettings();
  } catch {
    // Settings unavailable: keep the defaults.
  }
  const override = settings.pages[path] || {};
  const title = override.title?.trim() || page.defaults.title;
  const description = override.description?.trim() || page.defaults.description;
  return {
    ...base,
    title,
    description,
    // A page's openGraph replaces the layout's whole object: restate the image.
    openGraph: {
      type: 'website',
      locale: path === '/en' || path.startsWith('/en/') ? 'en_CA' : 'fr_CA',
      images: [{ url: '/og.png', width: 1730, height: 909, alt: title }],
      ...(base.openGraph || {}),
      title,
      description,
    },
    twitter: { card: 'summary_large_image', images: ['/og.png'], ...(base.twitter || {}), title, description },
    ...(override.noindex ? { robots: { index: false, follow: true } } : {}),
    ...(path === '/' && settings.googleVerification ? { verification: { google: settings.googleVerification } } : {}),
  };
}
