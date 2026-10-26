// The MEMOIRE_* variables come from the Supabase project connected through the
// Vercel integration; the unprefixed ones are the original project, kept as a fallback.
function publicUrl() {
  return process.env.NEXT_PUBLIC_MEMOIRE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function publicKey() {
  return (
    process.env.NEXT_PUBLIC_MEMOIRE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_MEMOIRE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

export function getSupabaseSecretKey() {
  if (process.env.NEXT_PUBLIC_MEMOIRE_SUPABASE_URL) {
    return process.env.MEMOIRE_SUPABASE_SECRET_KEY || process.env.MEMOIRE_SUPABASE_SERVICE_ROLE_KEY;
  }
  return process.env.SUPABASE_SECRET_KEY;
}

export function hasSupabasePublicConfig() {
  return Boolean(publicUrl() && publicKey());
}

export function hasSupabaseAdminConfig() {
  return hasSupabasePublicConfig() && Boolean(getSupabaseSecretKey());
}

export function getSupabasePublicConfig() {
  const url = publicUrl();
  const publishableKey = publicKey();
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export const supabaseMediaBucket =
  process.env.SUPABASE_MEDIA_BUCKET || 'project-media';
