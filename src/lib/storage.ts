/** Spec §9: warn in Settings when more than this share of the storage quota is used. */
export const STORAGE_WARN_RATIO = 0.8;

export function storageWarning(estimate?: { usage?: number; quota?: number }): string | null {
  if (!estimate?.quota || estimate.usage === undefined) return null;
  const ratio = estimate.usage / estimate.quota;
  if (!(ratio > STORAGE_WARN_RATIO)) return null;
  return `Storage is ${Math.round(ratio * 100)}% full. Export a backup so nothing is lost.`;
}

/** navigator.storage.estimate(), or undefined where it's missing or fails. */
export async function readStorageEstimate(): Promise<StorageEstimate | undefined> {
  try {
    return await navigator.storage?.estimate?.();
  } catch {
    return undefined;
  }
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
