import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ScheduleScreen from '../schedule/ScheduleScreen';
import SettingsScreen from '../settings/SettingsScreen';
import { resetDb } from '../../db/db';
import { archivePet, createPet } from '../../db/pets';
import { logFeeding } from '../../db/feedings';
import { completeCareTask, createCareTask } from '../../db/care';
import { mockShare, stubObjectUrls, unmockShare } from '../../test/share';

const now = new Date(2026, 10, 8, 9, 0);
const t = (d: number, h: number) => new Date(2026, 10, d, h, 0).toISOString();

async function pet(name: string, interval: number, food: string, fedDay: number) {
  const p = await createPet({ name, species: 'Reptile', feedingIntervalDays: interval, usualFoodItem: food });
  await logFeeding({ petId: p.id, at: t(fedDay, 18), foodItem: food, quantity: 1, outcome: 'ate' });
  return p;
}

afterEach(() => {
  unmockShare();
  vi.restoreAllMocks();
});

describe('Add all reminders (spec §8)', () => {
  beforeEach(async () => {
    await resetDb();
    await pet('Basil', 2, 'Dubia roaches', 5); // late: skipped
    await pet('Noodle', 5, 'Pinky mouse', 3); // today 6 PM
    const ziggy = await pet('Ziggy', 3, 'Crickets', 7); // Nov 10
    const pebble = await pet('Pebble', 2, 'Greens', 7); // archived: skipped
    await archivePet(pebble.id);
    const mist = await createCareTask({ petId: ziggy.id, name: 'Mist', intervalDays: 2 });
    await completeCareTask(mist.id, t(7, 20)); // Nov 9, 09:00
  });

  it('shares one .ics with the next occurrence of every feeding and care task', async () => {
    const { share, file } = mockShare();
    render(<MemoryRouter><ScheduleScreen now={now} /></MemoryRouter>);
    await userEvent.click(await screen.findByRole('button', { name: '📅 Add all reminders to Calendar' }));
    await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(file().name).toBe('reptender-reminders.ics');
    const ics = await file().text();
    expect([...ics.matchAll(/^SUMMARY:(.*)$/gm)].map((m) => m[1]!.trim())).toEqual([
      'Feed Noodle · 1 Pinky mouse', 'Mist · Ziggy', 'Feed Ziggy · 1 Crickets',
    ]);
    expect(await screen.findByRole('status')).toHaveTextContent('Shared 3 reminders.');
  });

  it('says how to finish when the file was downloaded instead', async () => {
    // Settings uses the real clock: a task created now is always due in the future.
    await createCareTask({ name: 'Deep clean', intervalDays: 30 });
    mockShare(false);
    stubObjectUrls();
    render(<MemoryRouter><SettingsScreen /></MemoryRouter>);
    const card = await screen.findByRole('group', { name: 'Reminders & data' });
    await userEvent.click(within(card).getByRole('button', { name: '📅 Add reminders to Calendar' }));
    expect(await within(card).findByRole('status')).toHaveTextContent(
      /^Downloaded reptender-reminders\.ics \(\d+ reminders?\)\. Open it to add them to Calendar\.$/,
    );
  });
});

it('says so when there is nothing to remind', async () => {
  await resetDb();
  const { share } = mockShare();
  render(<MemoryRouter><ScheduleScreen now={now} /></MemoryRouter>);
  await userEvent.click(await screen.findByRole('button', { name: '📅 Add all reminders to Calendar' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Nothing coming up to remind you about.');
  expect(share).not.toHaveBeenCalled();
});
