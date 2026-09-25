import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mémoire Maison',
    short_name: 'Mémoire Maison',
    description: 'Créez et préservez le livre souvenir de votre maison.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f4ee',
    theme_color: '#234a3d',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
