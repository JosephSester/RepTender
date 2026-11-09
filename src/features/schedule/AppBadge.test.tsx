import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import AppBadge from './AppBadge';
import { updateAppBadge } from '../../lib/badge';
import { resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { logFeeding } from '../../db/feedings';

const now = new Date(2026, 10, 8, 9, 0);
type BadgeNav = { setAppBadge?: unknown; clearAppBadge?: unknown };

function mockBadge() {
  const set = vi.fn(async (_count?: number) => {});
  const clear = vi.fn(async () => {});
  Object.defineProperty(navigator, 'setAppBadge', { value: set, configurable: true, writable: true });
  Object.defineProperty(navigator, 'clearAppBadge', { value: clear, configurable: true, writable: true });
  return { set, clear };
}

beforeEach(async () => {
  await resetDb();
});

afterEach(() => {
  delete (navigator as BadgeNav).setAppBadge;
  delete (navigator as BadgeNav).clearAppBadge;
  vi.restoreAllMocks();
});

it('shows the number of late and due-today items, and follows the data', async () => {
  const { set } = mockBadge();
  const noodle = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });
  await logFeeding({ petId: noodle.id, at: new Date(2026, 10, 3, 18, 0).toISOString(), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate' });
  await createPet({ name: 'Ziggy', species: 'Leopard Gecko', feedingIntervalDays: 3 }); // never fed: due now
  render(<AppBadge now={now} />);
  await vi.waitFor(() => expect(set).toHaveBeenLastCalledWith(2));

  await logFeeding({ petId: noodle.id, at: new Date(2026, 10, 8, 8, 0).toISOString(), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate' });
  await vi.waitFor(() => expect(set).toHaveBeenLastCalledWith(1));
});

it('clears the badge when nothing is due', async () => {
  const { set, clear } = mockBadge();
  render(<AppBadge now={now} />);
  await vi.waitFor(() => expect(clear).toHaveBeenCalledTimes(1));
  expect(set).not.toHaveBeenCalled();
});

it('is skipped silently where the Badging API is missing or fails', async () => {
  await expect(updateAppBadge(3)).resolves.toBeUndefined(); // no API at all
  const { set, clear } = mockBadge();
  set.mockRejectedValueOnce(new DOMException('Not allowed', 'NotAllowedError'));
  await expect(updateAppBadge(3)).resolves.toBeUndefined();
  clear.mockImplementationOnce(() => {
    throw new TypeError('Illegal invocation');
  });
  await expect(updateAppBadge(0)).resolves.toBeUndefined();
});
