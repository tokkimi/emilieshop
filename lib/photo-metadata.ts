'use client';
export async function photoMetadata(file: File): Promise<{ width?: number; height?: number; fingerprint: string }> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (!file.type.startsWith('image/')) return { fingerprint };
  try {
    const image = await createImageBitmap(file);
    const dimensions = { width: image.width, height: image.height, fingerprint };
    image.close(); return dimensions;
  } catch { return { fingerprint }; }
}
