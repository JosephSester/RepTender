import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { blobToDataUrl, dataUrlToBlob } from './base64';

beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob); // a real Blob implementation (jsdom's can't be read back from IndexedDB)
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it('encodes a blob as a data URL that keeps its type, and decodes it back', async () => {
  const bytes = new Uint8Array(70000).map((_, i) => (i * 7) % 256); // larger than one encoding chunk
  const url = await blobToDataUrl(new Blob([bytes], { type: 'image/jpeg' }));
  expect(url.startsWith('data:image/jpeg;base64,')).toBe(true);
  const back = dataUrlToBlob(url)!;
  expect(back.type).toBe('image/jpeg');
  expect(new Uint8Array(await back.arrayBuffer())).toEqual(bytes);
  expect(await blobToDataUrl(new Blob(['hi']))).toBe('data:application/octet-stream;base64,aGk=');
});

it('rejects anything that is not a base64 data URL', () => {
  expect(dataUrlToBlob('data:image/jpeg;base64,@@@')).toBeNull();
  expect(dataUrlToBlob('data:image/jpeg;base64,abc')).toBeNull(); // bad length
  expect(dataUrlToBlob('https://example.com/a.jpg')).toBeNull();
  expect(dataUrlToBlob('data:image/jpeg;base64,')).not.toBeNull(); // an empty file is still a file
});
