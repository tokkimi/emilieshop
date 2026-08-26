import type { MetadataRoute } from 'next';

const origin = 'https://memoire-maison-emilie.bimabima700700.chatgpt.site';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${origin}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${origin}/en`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${origin}/professionnels`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${origin}/en/professionals`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${origin}/memory/demo`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${origin}/en/memory/demo`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${origin}/conditions-generales`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${origin}/politique-confidentialite`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${origin}/livraison-retours`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${origin}/consentements`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${origin}/en/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${origin}/en/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
