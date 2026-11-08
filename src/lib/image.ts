export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function decodeViaImageElement(file: Blob): Promise<Decoded> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    // Browsers apply EXIF orientation to <img> by default.
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Browser-only: decode an image with EXIF orientation applied. Older iOS Safari rejects
 * `imageOrientation: 'from-image'`, so fall back to plain createImageBitmap, then to an <img>.
 */
export async function decodeImage(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    for (const options of [{ imageOrientation: 'from-image' as const }, undefined]) {
      try {
        const bitmap = await (options ? createImageBitmap(file, options) : createImageBitmap(file));
        return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
      } catch {
        // try the next strategy
      }
    }
  }
  return decodeViaImageElement(file);
}

/** Browser-only: decode, downscale and re-encode an image as JPEG. */
export async function resizeToJpeg(
  file: Blob,
  max: number,
  quality = 0.8,
): Promise<{ blob: Blob; width: number; height: number }> {
  const decoded = await decodeImage(file);
  try {
    const size = fitWithin(decoded.width, decoded.height, max);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available');
    ctx.fillStyle = '#fff'; // JPEG has no alpha: keep transparent PNGs from turning black
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.drawImage(decoded.source, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode photo'))), 'image/jpeg', quality),
    );
    return { blob, ...size };
  } finally {
    decoded.release();
  }
}

/** Spec §5.16: 1024px full image + 256px thumbnail, JPEG quality 0.8. */
export async function photoFromFile(file: Blob) {
  const full = await resizeToJpeg(file, 1024, 0.8);
  const thumb = await resizeToJpeg(file, 256, 0.8);
  return { blob: full.blob, thumbBlob: thumb.blob, width: full.width, height: full.height };
}
