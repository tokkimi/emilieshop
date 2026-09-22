export type Locale = 'fr' | 'en';
export type PlanId = 'essential' | 'keepsake' | 'family';
export type AddOnId = 'extra-copy' | 'mini-film' | 'memory-link' | 'digital-frame';

export type CatalogPlan = {
  id: PlanId;
  name: Record<Locale, string>;
  tagline: Record<Locale, string>;
  priceCents: number;
  pageCount: number;
  copies: number;
  memoryLinkYears: number;
  estimatedFulfilmentCostCents: number;
};

export const CATALOG_PLANS: readonly CatalogPlan[] = [
  { id: 'essential', name: { fr: 'Essentiel', en: 'Essential' }, tagline: { fr: '24 pages · 1 livre rigide · aperçu et PDF', en: '24 pages · 1 hardcover · proof and PDF' }, priceCents: 14900, pageCount: 24, copies: 1, memoryLinkYears: 0, estimatedFulfilmentCostCents: 5200 },
  { id: 'keepsake', name: { fr: 'Souvenir', en: 'Keepsake' }, tagline: { fr: '24 pages · 1 livre rigide · Memory Link 1 an', en: '24 pages · 1 hardcover · 1-year Memory Link' }, priceCents: 22900, pageCount: 24, copies: 1, memoryLinkYears: 1, estimatedFulfilmentCostCents: 7900 },
  { id: 'family', name: { fr: 'Famille', en: 'Family' }, tagline: { fr: '24 pages · 2 exemplaires · Memory Link 3 ans', en: '24 pages · 2 copies · 3-year Memory Link' }, priceCents: 32900, pageCount: 24, copies: 2, memoryLinkYears: 3, estimatedFulfilmentCostCents: 12400 },
] as const;

export const CATALOG_ADD_ONS = [
  { id: 'extra-copy' as AddOnId, name: { fr: 'Exemplaire supplémentaire', en: 'Extra copy' }, detail: { fr: 'Un exemplaire identique, imprimé à la demande', en: 'One identical print-on-demand copy' }, priceCents: 6900 },
  { id: 'mini-film' as AddOnId, name: { fr: 'Mini-film « Notre maison »', en: '“Our Home” mini-film' }, detail: { fr: '1 à 3 minutes à partir de vos photos et vidéos', en: '1–3 minutes from your photos and videos' }, priceCents: 9900 },
  { id: 'memory-link' as AddOnId, name: { fr: 'Memory Link · 1 an', en: 'Memory Link · 1 year' }, detail: { fr: 'Page privée pour photos, vidéos et voix', en: 'Private page for photos, films and voices' }, priceCents: 4900 },
  { id: 'digital-frame' as AddOnId, name: { fr: 'Cadre numérique préchargé', en: 'Preloaded digital frame' }, detail: { fr: 'Cadre configuré avec votre sélection', en: 'Frame configured with your selection' }, priceCents: 14900 },
] as const;

export const ARCHIVE_PRICING = { monthlyCents: 900, annualCents: 9000 };
export const CART_STORAGE_KEY = 'memoire-maison-cart-v1';
export const PROFESSIONAL_PLANS = [
  { id: 'starter', credits: 10, priceCents: 139000, unitCents: 13900 },
  { id: 'team', credits: 25, priceCents: 325000, unitCents: 13000 },
  { id: 'agency', credits: 50, priceCents: 625000, unitCents: 12500 },
  { id: 'network', credits: 100, priceCents: 1190000, unitCents: 11900 },
] as const;

export function getPlan(id: string) { return CATALOG_PLANS.find((plan) => plan.id === id) || CATALOG_PLANS[0]; }
export function formatCad(cents: number, locale: Locale = 'fr') { return new Intl.NumberFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(cents / 100); }
export function calculateCatalogSubtotal(planId: string, addOnIds: string[]) { const plan = getPlan(planId); return plan.priceCents + CATALOG_ADD_ONS.filter((item) => addOnIds.includes(item.id)).reduce((total, item) => total + item.priceCents, 0); }
export function assertSustainablePrice(planId: string, subtotalCents: number) { const plan = getPlan(planId); if (subtotalCents - plan.estimatedFulfilmentCostCents < 6500) throw new Error('Le prix calculé ne protège pas la marge minimale.'); }
export function estimateShippingCents(countryCode:string){const country=countryCode.trim().toUpperCase();if(country==='CA')return 1900;if(country==='US')return 2900;return 3900;}
