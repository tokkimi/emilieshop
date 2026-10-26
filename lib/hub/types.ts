// Contrat partagé entre la console centrale (i-ateliers) et chaque site connecté.
// Le même fichier est copié dans Guides Immo Québec et Mémoire Maison : chaque site
// décrit lui-même ses sections d'administration, la console ne fait que les afficher.
// Toute modification doit être reportée dans les trois dépôts.

export type HubCell = string | number | boolean | null;

export type HubFormat = 'text' | 'money' | 'number' | 'percent' | 'date' | 'datetime' | 'badge' | 'longtext' | 'link';

export type HubColumn = { key: string; label: string; format?: HubFormat; align?: 'right' };

export type HubField = {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'date' | 'datetime-local' | 'url' | 'email' | 'checkbox';
  options?: { value: string; label: string }[];
  required?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  default?: string | number | boolean;
};

export type HubAction = {
  label: string;
  action: string;
  payload?: Record<string, unknown>;
  confirm?: string;
  fields?: HubField[];
  tone?: 'danger';
};

export type HubRow = { [key: string]: HubCell | HubAction[] | undefined; _actions?: HubAction[] };

export type HubBlock =
  | { type: 'metrics'; items: { label: string; value: number | string; format?: HubFormat; hint?: string }[] }
  | { type: 'table'; title: string; description?: string; columns: HubColumn[]; rows: HubRow[]; empty?: string }
  | { type: 'form'; title: string; description?: string; action: HubAction }
  | { type: 'status'; title: string; items: { label: string; ok: boolean; detail?: string }[] }
  | { type: 'bars'; title: string; format?: HubFormat; items: { label: string; value: number }[] }
  | { type: 'notes'; title?: string; items: string[] }
  | { type: 'links'; title: string; items: { label: string; href: string }[] };

export type HubSection = { id: string; label: string; icon?: string; badge?: number; blocks: HubBlock[] };

export type HubSnapshot = { generatedAt: string; currency: string; sections: HubSection[] };

export type HubActionResult = { ok: boolean; message?: string; url?: string };
