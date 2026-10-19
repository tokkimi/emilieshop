'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;
  // Same order as lib/supabase/config.ts (written out so Next inlines them).
  const url = process.env.NEXT_PUBLIC_MEMOIRE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_MEMOIRE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_MEMOIRE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  browserClient = createBrowserClient(url, publishableKey);
  return browserClient;
}
