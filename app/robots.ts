import type { MetadataRoute } from 'next';

const origin = 'https://memoire-maison-emilie.bimabima700700.chatgpt.site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/api/',
        '/apercu',
        '/atelier',
        '/connexion',
        '/demo/',
        '/profil',
        '/en/preview',
        '/en/profile',
        '/en/sign-in',
        '/en/studio',
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
