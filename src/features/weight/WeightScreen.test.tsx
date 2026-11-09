import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import WeightScreen from './WeightScreen';
import { resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { updateSettings } from '../../db/settings';
import { listMeasurements, logMeasurement } from '../../db/measurements';
import { renderAt } from '../../test/render';

const now = new Date(2026, 10, 8, 9, 0);
let petId: string;

beforeEach(async () => {
  await resetDb();
  petId = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
  await logMeasurement({ petId, date: '2026-09-01', weightG: 36 });
  await logMeasurement({ petId, date: '2026-10-01', weightG: 39, lengthMm: 431.8 });
  await logMeasurement({ petId, date: '2026-11-01', weightG: 42, lengthMm: 457.2 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderWeight() {
  return render(
    <MemoryRouter initialEntries={[`/pets/${petId}/weight`]}>
      <Routes>
        <Route path="/pets/:id/weight" element={<WeightScreen now={now} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('WeightScreen', () => {
  it('shows the current weight, the 30-day change, the length, the chart and the entries', async () => {
    renderWeight();
    expect(await screen.findByRole('heading', { name: 'Weight & length' })).toBeInTheDocument();
    expect(screen.getByText('42 g')).toBeInTheDocument();
    expect(screen.getByText('Nov 1 · ↑ 3 g in 30 days')).toBeInTheDocument();
    expect(screen.getByText('18 in')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Weight chart, 3 entries' })).toBeInTheDocument();
    const items = screen.getAllByRole('article');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Nov 1, 2026');
    expect(items[0]).toHaveTextContent('42 g · 18 in');
    expect(items[2]).toHaveTextContent('36 g');
  });

  it('switches the chart range', async () => {
    await logMeasurement({ petId, date: '2025-01-15', weightG: 10 });
    renderWeight();
    expect(await screen.findByRole('img', { name: 'Weight chart, 3 entries' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'All' }));
    expect(screen.getByRole('img', { name: 'Weight chart, 4 entries' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: '1Y' }));
    expect(screen.getByRole('img', { name: 'Weight chart, 3 entries' })).toBeInTheDocument();
  });

  it('shows and accepts the units from Settings', async () => {
    await updateSettings({ weightUnit: 'oz' });
    renderWeight();
    expect(await screen.findByText('1.5 oz')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Log weight or length' }));
    const sheet = screen.getByRole('dialog', { name: 'Log weight & length' });
    await userEvent.type(within(sheet).getByLabelText('Weight (oz)'), '1.6');
    await userEvent.type(within(sheet).getByLabelText('Length (in)'), '18.5');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save entry' }));
    await vi.waitFor(async () => expect(await listMeasurements(petId)).toHaveLength(4));
    const latest = (await listMeasurements(petId)).at(-1)!;
    expect(latest.date).toBe('2026-11-08');
    expect(latest.weightG).toBeCloseTo(45.359, 3);
    expect(latest.lengthMm).toBeCloseTo(469.9, 3);
  });

  it('asks for a weight or a length', async () => {
    renderWeight();
    await userEvent.click(await screen.findByRole('button', { name: 'Log weight or length' }));
    const sheet = screen.getByRole('dialog', { name: 'Log weight & length' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save entry' }));
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('Enter a weight or a length');
  });

  it('a cleared date blocks saving without crashing', async () => {
    renderWeight();
    await userEvent.click(await screen.findByRole('button', { name: 'Log weight or length' }));
    const sheet = screen.getByRole('dialog', { name: 'Log weight & length' });
    await userEvent.clear(within(sheet).getByLabelText('Date'));
    expect(within(sheet).getByRole('button', { name: 'Save entry' })).toBeDisabled();
  });

  it('deletes an entry after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWeight();
    const [first] = await screen.findAllByRole('article');
    await userEvent.click(within(first!).getByRole('button', { name: 'Delete' }));
    await vi.waitFor(async () => expect(await listMeasurements(petId)).toHaveLength(2));
  });

  it('is routed at /pets/:id/weight', async () => {
    renderAt(`/pets/${petId}/weight`);
    expect(await screen.findByRole('heading', { name: 'Weight & length' })).toBeInTheDocument();
  });
});
