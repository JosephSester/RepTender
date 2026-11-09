export type DeliverResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * Spec §8 / §9: hand a file to the share sheet (Calendar, Files, AirDrop, Mail) when the browser
 * can share files, otherwise fall back to a download link to a blob URL.
 *
 * Call it straight from a tap handler with a file built synchronously: `navigator.share` must run
 * before any `await`, or iOS rejects it for lack of a user gesture.
 */
export async function deliverFile(file: File): Promise<DeliverResult> {
  const canShareFiles =
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] });
  if (canShareFiles) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (err) {
      if ((err as { name?: string } | null)?.name === 'AbortError') return 'cancelled';
      // NotAllowedError (the gesture expired) or a share target failure: download instead.
    }
  }
  downloadFile(file);
  return 'downloaded';
}

/** A temporary <a download> on a blob URL. The URL is revoked a minute later. */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
