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
    icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
