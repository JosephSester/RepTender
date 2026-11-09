import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CareTasksScreen from './CareTasksScreen';
import { resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { completeCareTask, createCareTask } from '../../db/care';
import { mockShare, unmockShare } from '../../test/share';

const now = new Date(2026, 10, 8, 9, 0);
let noodle: string;

beforeEach(async () => {
  await resetDb();
  noodle = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
  const mist = await createCareTask({ petId: noodle, name: 'Mist', intervalDays: 2, timeOfDay: '20:00' });
  await completeCareTask(mist.id, new Date(2026, 10, 7, 20, 0).toISOString()); // due Nov 9, 8:00 PM
  const water = await createCareTask({ name: 'Fresh water', intervalDays: 2 });
  await completeCareTask(water.id, new Date(2026, 10, 7, 9, 0).toISOString()); // due Nov 9 → 09:00
  const clean = await createCareTask({ petId: noodle, name: 'Spot clean', intervalDays: 1 });
  await completeCareTask(clean.id, new Date(2026, 10, 6, 9, 0).toISOString()); // 1 day late
});

afterEach(() => {
  unmockShare();
  vi.restoreAllMocks();
});

const renderCare = () =>
  render(
    <MemoryRouter initialEntries={[`/pets/${noodle}/care`]}>
      <Routes>
        <Route path="/pets/:id/care" element={<CareTasksScreen now={now} />} />
      </Routes>
    </MemoryRouter>,
  );

it('adds a care task to Calendar as one event at its time', async () => {
  const { share, file } = mockShare();
  renderCare();
  const card = await screen.findByRole('article', { name: 'Mist' });
  const add = within(card).getByRole('button', { name: 'Add Mist to Calendar' });
  await userEvent.click(add);
  await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  const ics = await file().text();
  expect(ics).toContain('SUMMARY:Mist · Noodle');
  expect(ics).toMatch(/UID:[\w-]+-2026-11-09@reptender/);
  expect(ics).toContain(`DTSTART:${new Date(2026, 10, 9, 20, 0).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`);
  expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  await vi.waitFor(() => expect(add).toBeEnabled()); // the busy flag is cleared before the test ends
});

it('uses 09:00 for a task with no time, and names All-pets tasks', async () => {
  const { share, file } = mockShare();
  renderCare();
  const add = await screen.findByRole('button', { name: 'Add Fresh water to Calendar' });
  await userEvent.click(add);
  await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  const ics = await file().text();
  expect(ics).toContain('SUMMARY:Fresh water · All pets');
  await vi.waitFor(() => expect(add).toBeEnabled());
  expect(ics).toContain(`DTSTART:${new Date(2026, 10, 9, 9, 0).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`);
});

it('offers no calendar button for a late task', async () => {
  renderCare();
  const card = await screen.findByRole('article', { name: 'Spot clean' });
  expect(within(card).getByText('1 day late')).toBeInTheDocument();
  expect(within(card).queryByRole('button', { name: 'Add Spot clean to Calendar' })).toBeNull();
});
