const CHUNK = 0x8000; // String.fromCharCode(...bytes) on a whole photo would overflow the call stack

/** Blob → `data:<type>;base64,…` (spec §9: photos are base64-encoded in the backup). */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`;
}

// Only raster image types (no SVG, HTML or script): a backup is not a way to smuggle active content into the app's origin.
export const IMPORTABLE_IMAGE_TYPE = /^image\/(?:jpeg|png|webp|gif)$/;
const DATA_URL =/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]*={0,2})$/;

/** The reverse of blobToDataUrl, or null for anything that isn't a valid base64 image data URL. */
export function dataUrlToBlob(url: string): Blob | null {
  const m = DATA_URL.exec(url);
  if (!m || m[2]!.length % 4 !== 0) return null;
  let binary: string;
  try {
    binary = atob(m[2]!);
  } catch {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}
