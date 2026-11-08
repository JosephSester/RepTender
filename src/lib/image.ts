export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Browser-only: decode, downscale and re-encode an image as JPEG. */
export async function resizeToJpeg(
  file: Blob,
  max: number,
  quality = 0.8,
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const size = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode photo'))), 'image/jpeg', quality),
  );
  return { blob, ...size };
}

/** Spec §5.16: 1024px full image + 256px thumbnail, JPEG quality 0.8. */
export async function photoFromFile(file: Blob) {
  const full = await resizeToJpeg(file, 1024, 0.8);
  const thumb = await resizeToJpeg(file, 256, 0.8);
  return { blob: full.blob, thumbBlob: thumb.blob, width: full.width, height: full.height };
}
