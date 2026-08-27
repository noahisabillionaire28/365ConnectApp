/**
 * Client-side image compression for uploads.
 *
 * Resizes to a max dimension (default 1080px) and re-encodes as JPEG, stepping
 * quality down until the result is under the target size (default ~500KB).
 * Best-effort: non-images pass through untouched, and any failure returns the
 * original file so an upload never breaks because compression didn't work.
 */
function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality));
}

export async function compressImage(
  file: File | Blob,
  maxDim = 1080,
  maxBytes = 500_000,
): Promise<Blob> {
  const type = (file as File).type || '';
  // Only compress raster images (leave videos, audio, gifs, svg, etc. alone).
  if (!type.startsWith('image/') || type === 'image/gif' || type === 'image/svg+xml') {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;

    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close?.(); return file; }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    let quality = 0.9;
    let blob = await canvasToBlob(canvas, quality);
    while (blob && blob.size > maxBytes && quality > 0.4) {
      quality -= 0.1;
      blob = await canvasToBlob(canvas, quality);
    }

    // If somehow larger than the original, keep the original.
    if (blob && blob.size < (file as File).size) return blob;
    return file;
  } catch {
    return file;
  }
}
