import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ScheduleScreen from './ScheduleScreen';
import { resetDb } from '../../db/db';
import { archivePet, createPet } from '../../db/pets';
import { logFeeding } from '../../db/feedings';
import { completeCareTask, createCareTask } from '../../db/care';
import { renderAt } from '../../test/render';

const now = new Date(2026, 10, 8, 9, 0);
const t = (m: number, d: number, h: number) => new Date(2026, m, d, h, 0).toISOString();

async function pet(name: string, interval: number, food: string, qty: number, fedAt: string) {
  const p = await createPet({ name, species: 'Reptile', feedingIntervalDays: interval, usualFoodItem: food, usualQuantity: qty });
  await logFeeding({ petId: p.id, at: fedAt, foodItem: food, quantity: qty, outcome: 'ate' });
  return p;
}
async function task(name: string, intervalDays: number, petId: string | undefined, doneAt: string) {
  const tk = await createCareTask({ petId, name, intervalDays });
  await completeCareTask(tk.id, doneAt);
  return tk;
}

beforeEach(async () => {
  await resetDb();
  const basil = await pet('Basil', 2, 'Dubia roaches', 12, t(10, 5, 18)); // late
  const noodle = await pet('Noodle', 5, 'Pinky mouse', 1, t(10, 3, 18)); // due today
  await pet('Ziggy', 3, 'Crickets', 8, t(10, 8, 8)); // fed this morning
  const pebble = await pet('Pebble', 2, 'Greens', 1, t(10, 1, 18)); // late, but archived
  await archivePet(pebble.id);
  await task('Spot clean', 1, basil.id, t(10, 8, 7)); // done today
  await task('Fresh water', 2, undefined, t(10, 6, 9)); // due today
  await task('Deep clean', 30, noodle.id, t(9, 16, 9)); // Nov 15
  await task('Soak', 1, pebble.id, t(10, 1, 9)); // archived pet: hidden
});

const renderSchedule = () => render(<MemoryRouter><ScheduleScreen now={now} /></MemoryRouter>);
const todayTitles = () =>
  within(screen.getByRole('region', { name: "Today's checklist" }))
    .getAllByRole('group')
    .map((g) => g.getAttribute('aria-label'));

describe('ScheduleScreen', () => {
  it("lists today's feedings and care tasks across active pets, and what's coming up", async () => {
    renderSchedule();
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByText('Sunday, Nov 8 · 2 of 5 done')).toBeInTheDocument();
    expect(todayTitles()).toEqual(['Feed Basil', 'Fresh water', 'Feed Noodle', 'Spot clean', 'Feed Ziggy']);
    const basil = screen.getByRole('group', { name: 'Feed Basil' });
    expect(within(basil).getByText('12 Dubia roaches')).toBeInTheDocument();
    expect(within(basil).getByText('1 day late')).toHaveClass('pill-late');
    expect(screen.getByRole('button', { name: 'Spot clean done today' })).toHaveAttribute('aria-pressed', 'true');

    const coming = screen.getByRole('region', { name: 'Coming up' });
    expect(within(coming).getByRole('group', { name: 'Tomorrow' })).toHaveTextContent('Spot clean · Basil · daily');
    expect(within(coming).getByRole('group', { name: 'Wed, Nov 11' })).toHaveTextContent('Feed Ziggy · 8 Crickets');
    expect(within(coming).getByRole('group', { name: 'Sun, Nov 15' })).toHaveTextContent('Deep clean · Noodle · every 30 days');
  });

  it('checking a care task completes it', async () => {
    renderSchedule();
    await userEvent.click(await screen.findByRole('button', { name: 'Fresh water done today' }));
    expect(await screen.findByText('Sunday, Nov 8 · 3 of 5 done')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fresh water done today' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('checking a feeding opens the Log a Feeding sheet', async () => {
    renderSchedule();
    await userEvent.click(await screen.findByRole('button', { name: 'Log feeding for Noodle' }));
    const sheet = screen.getByRole('dialog', { name: 'Feed Noodle' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save feeding' }));
    expect(await screen.findByText('Sunday, Nov 8 · 3 of 5 done')).toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Fed Noodle today' })).toBeDisabled());
  });

  it('is the Schedule tab at /schedule', async () => {
    renderAt('/schedule');
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Schedule' })).toHaveClass('active');
  });
});
