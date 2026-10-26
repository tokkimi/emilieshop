'use client';

import { createSupabaseBrowserClient } from './supabase/client';

export async function uploadMedia(projectId: string, file: File): Promise<{ id: string }> {
  if (!file.size || file.size > 25 * 1024 * 1024) throw new Error('Choisissez un fichier de moins de 25 Mo.');
  const prepared = await fetch('/api/uploads/direct', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'prepare', projectId, filename: file.name, contentType: file.type, size: file.size }),
  });
  const upload = await prepared.json() as { error?: string; bucket: string; path: string; token: string; id: string };
  if (!prepared.ok) throw new Error(upload.error || 'Préparation du téléversement impossible.');
  const client = createSupabaseBrowserClient();
  if (!client) throw new Error('Le stockage est indisponible.');
  const { error } = await client.storage.from(upload.bucket).uploadToSignedUrl(upload.path, upload.token, file, { contentType: file.type });
  if (error) throw new Error('Le fichier n’a pas pu être envoyé. Réessayez.');
  const completed = await fetch('/api/uploads/direct', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'complete', projectId, id: upload.id, path: upload.path, filename: file.name }),
  });
  const result = await completed.json() as { error?: string; id: string };
  if (!completed.ok) throw new Error(result.error || 'Enregistrement du fichier impossible.');
  return { id: result.id };
}
