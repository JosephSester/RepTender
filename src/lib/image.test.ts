import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeImage, fitWithin } from './image';

describe('fitWithin', () => {
  it('scales the long edge down to the max', () => {
    expect(fitWithin(4032, 3024, 1024)).toEqual({ width: 1024, height: 768 });
    expect(fitWithin(3024, 4032, 256)).toEqual({ width: 192, height: 256 });
  });
  it('never scales up', () => {
    expect(fitWithin(800, 600, 1024)).toEqual({ width: 800, height: 600 });
  });
});

describe('decodeImage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('falls back to plain createImageBitmap when the orientation option throws', async () => {
    const close = vi.fn();
    const bitmap = { width: 40, height: 30, close };
    const stub = vi.fn((_file: Blob, options?: object) =>
      options ? Promise.reject(new TypeError('unsupported option')) : Promise.resolve(bitmap),
    );
    vi.stubGlobal('createImageBitmap', stub);
    const decoded = await decodeImage(new Blob(['x']));
    expect(stub).toHaveBeenCalledTimes(2);
    expect(stub.mock.calls[0][1]).toEqual({ imageOrientation: 'from-image' });
    expect(stub.mock.calls[1][1]).toBeUndefined();
    expect(decoded).toMatchObject({ width: 40, height: 30 });
    decoded.release();
    expect(close).toHaveBeenCalled();
  });
});
