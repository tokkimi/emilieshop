import { createHash, timingSafeEqual } from 'node:crypto';

// Seule la console centrale d'Emilie (i-ateliers.com/console) connaît HUB_SECRET.
// Sans secret configuré (ou trop court), le point d'accès reste fermé.
export function isHubRequest(req: Request): boolean {
  const secret = process.env.HUB_SECRET;
  if (!secret || secret.length < 32) return false;
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return false;
  const a = createHash('sha256').update(header.slice(7)).digest();
  const b = createHash('sha256').update(secret).digest();
  return timingSafeEqual(a, b);
}
