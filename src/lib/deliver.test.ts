import { afterEach, describe, expect, it, vi } from 'vitest';
import { deliverFile } from './deliver';
import { mockShare, stubObjectUrls, unmockShare } from '../test/share';

const file = () => new File(['BEGIN:VCALENDAR'], 'reptender-reminder.ics', { type: 'text/calendar' });

afterEach(() => {
  unmockShare();
  vi.restoreAllMocks();
});

describe('deliverFile (spec §8: share sheet, else a download link)', () => {
  it('opens the share sheet when the browser can share the file', async () => {
    const { share, file: shared } = mockShare();
    const urls = stubObjectUrls();
    const f = file();
    expect(await deliverFile(f)).toBe('shared');
    expect(share).toHaveBeenCalledTimes(1);
    expect(shared()).toBe(f);
    expect(urls.click).not.toHaveBeenCalled();
  });

  it('reports a cancelled share sheet without downloading', async () => {
    const { share } = mockShare();
    share.mockRejectedValueOnce(new DOMException('Share canceled', 'AbortError'));
    const urls = stubObjectUrls();
    expect(await deliverFile(file())).toBe('cancelled');
    expect(urls.click).not.toHaveBeenCalled();
  });

  it('falls back to a download when sharing fails for another reason', async () => {
    const { share } = mockShare();
    share.mockRejectedValueOnce(new DOMException('No user gesture', 'NotAllowedError'));
    const urls = stubObjectUrls();
    expect(await deliverFile(file())).toBe('downloaded');
    expect(urls.click).toHaveBeenCalledTimes(1);
  });

  it('downloads a blob URL when files cannot be shared', async () => {
    const { share } = mockShare(false);
    const urls = stubObjectUrls();
    const f = file();
    expect(await deliverFile(f)).toBe('downloaded');
    expect(share).not.toHaveBeenCalled();
    expect(urls.create).toHaveBeenCalledWith(f);
    const anchor = urls.click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('reptender-reminder.ics');
    expect(anchor.getAttribute('href')).toBe('blob:reptender-test');
    expect(anchor.isConnected).toBe(false); // removed again after the click
  });

  it('downloads when there is no Web Share API at all', async () => {
    const urls = stubObjectUrls();
    expect(await deliverFile(file())).toBe('downloaded');
    expect(urls.click).toHaveBeenCalledTimes(1);
  });
});
