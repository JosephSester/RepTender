import { vi } from 'vitest';

type ShareFn = (data: ShareData) => Promise<void>;

/** Pretend the browser can share files. `file(n)` is the first file of the n-th share call. */
export function mockShare(canShare = true) {
  const share = vi.fn<ShareFn>(async () => {});
  Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true });
  Object.defineProperty(navigator, 'canShare', { value: vi.fn(() => canShare), configurable: true, writable: true });
  return {
    share,
    file: (n = 0): File => share.mock.calls[n]![0].files![0]!,
  };
}

/** Undo mockShare (jsdom has no Web Share API of its own). */
export function unmockShare(): void {
  delete (navigator as { share?: unknown }).share;
  delete (navigator as { canShare?: unknown }).canShare;
}

/** jsdom can't make object URLs for its own Blobs: stub them, and stop the anchor click from navigating. */
export function stubObjectUrls() {
  const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:reptender-test');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  return { create, revoke, click };
}
