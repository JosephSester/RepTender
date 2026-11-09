import { useSyncExternalStore } from 'react';

/** How long the toast stays up on its own. */
export const TOAST_MS = 10_000;

export interface RemindToastState {
  petId: string;
  /** Changes on every show, so the same pet logged twice restarts the timer. */
  id: number;
}

let state: RemindToastState | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Called by LogFeedingSheet after a successful save. */
export function showRemindToast(petId: string): void {
  state = { petId, id: ++seq };
  emit();
}

export function hideRemindToast(): void {
  if (!state) return;
  state = null;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRemindToast(): RemindToastState | null {
  return useSyncExternalStore(subscribe, () => state, () => null);
}
