import { afterEach, expect, it } from 'vitest';
import { formatBytes, readStorageEstimate, storageWarning } from './storage';

afterEach(() => {
  delete (navigator as { storage?: unknown }).storage;
});

it('warns above 80% of the quota', () => {
  expect(storageWarning({ usage: 85, quota: 100 })).toBe('Storage is 85% full. Export a backup so nothing is lost.');
  expect(storageWarning({ usage: 80, quota: 100 })).toBeNull();
  expect(storageWarning({ usage: 10, quota: 100 })).toBeNull();
  expect(storageWarning({ usage: 10 })).toBeNull();
  expect(storageWarning(undefined)).toBeNull();
});

it('reads the estimate, or nothing when the API is missing or fails', async () => {
  expect(await readStorageEstimate()).toBeUndefined();
  Object.defineProperty(navigator, 'storage', { value: { estimate: async () => ({ usage: 1, quota: 2 }) }, configurable: true });
  expect(await readStorageEstimate()).toEqual({ usage: 1, quota: 2 });
  Object.defineProperty(navigator, 'storage', { value: { estimate: async () => { throw new Error('nope'); } }, configurable: true });
  expect(await readStorageEstimate()).toBeUndefined();
});

it('formats file sizes', () => {
  expect(formatBytes(300)).toBe('1 KB');
  expect(formatBytes(48_000)).toBe('47 KB');
  expect(formatBytes(2_500_000)).toBe('2.4 MB');
});
