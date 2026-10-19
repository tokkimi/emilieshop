export const money = (cents: number) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format((cents || 0) / 100);

export const moneyShort = (cents: number) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format((cents || 0) / 100);

export const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('fr-CA', { timeZone: 'America/Toronto', dateStyle: 'medium', timeStyle: 'short' }) : '—';

export const dateOnly = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('fr-CA', { timeZone: 'America/Toronto', dateStyle: 'medium' }) : '—';

export const ORDER_STATUS: Record<string, { label: string; tone: '' | 'good' | 'warn' | 'bad' }> = {
  pending: { label: 'En attente', tone: 'warn' },
  awaiting_payment: { label: 'Paiement en attente', tone: 'warn' },
  paid: { label: 'Payée', tone: 'good' },
  preflight: { label: 'Vérification impression', tone: '' },
  printing: { label: 'En impression', tone: '' },
  shipped: { label: 'Expédiée', tone: 'good' },
  delivered: { label: 'Livrée', tone: 'good' },
  cancelled: { label: 'Annulée', tone: 'bad' },
  refunded: { label: 'Remboursée', tone: 'bad' },
  blocked: { label: 'Bloquée', tone: 'bad' },
};

export async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || 'Une erreur est survenue.');
  return body;
}
