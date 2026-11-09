import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import HabitatScreen from './HabitatScreen';
import { resetDb } from '../../db/db';
import { createPet, getPet } from '../../db/pets';
import { listHabitatReadings, logHabitatReading } from '../../db/habitat';
import { tempToC } from '../../domain/units';
import { renderAt } from '../../test/render';

const now = new Date(2026, 10, 8, 9, 0);
const f = (deg: number) => tempToC(deg, 'F');
let petId: string;

beforeEach(async () => {
  await resetDb();
  petId = (
    await createPet({
      name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5, enclosureLabel: '40-gal tank',
      habitatTargets: { warmMinC: f(85), warmMaxC: f(90), coolMinC: f(72), coolMaxC: f(78), humidityMin: 40, humidityMax: 60 },
    })
  ).id;
  for (const d of [2, 3, 4, 5, 6, 7]) {
    await logHabitatReading({ petId, at: new Date(2026, 10, d, 8, 15).toISOString(), warmC: f(88) });
  }
  await logHabitatReading({ petId, at: new Date(2026, 10, 8, 8, 15).toISOString(), warmC: f(88), coolC: f(74), humidityPct: 52 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderHabitat(id = petId) {
  return render(
    <MemoryRouter initialEntries={[`/pets/${id}/habitat`]}>
      <Routes>
        <Route path="/pets/:id/habitat" element={<HabitatScreen now={now} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('HabitatScreen', () => {
  it('shows the enclosure, each value against its target, and the warm-side week', async () => {
    renderHabitat();
    expect(await screen.findByText('40-gal tank · last reading Today, 8:15 AM')).toBeInTheDocument();
    const warm = screen.getByRole('group', { name: 'Warm side' });
    expect(within(warm).getByText('Target 85–90°F')).toBeInTheDocument();
    expect(within(warm).getByText('88°F')).toBeInTheDocument();
    const cool = screen.getByRole('group', { name: 'Cool side' });
    expect(within(cool).getByText('Target 72–78°F')).toBeInTheDocument();
    expect(within(cool).getByText('74°F')).toBeInTheDocument();
    const humidity = screen.getByRole('group', { name: 'Humidity' });
    expect(within(humidity).getByText('Target 40–60%')).toBeInTheDocument();
    expect(within(humidity).getByText('52%')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Warm side, last 7 days, 7 readings' })).toBeInTheDocument();
    expect(screen.getByText('In range all week ✓')).toBeInTheDocument();
  });

  it('flags a value outside its target', async () => {
    await logHabitatReading({ petId, at: new Date(2026, 10, 8, 8, 30).toISOString(), coolC: f(86) });
    renderHabitat();
    const cool = await screen.findByRole('group', { name: 'Cool side' });
    expect(within(cool).getByText('86°F')).toBeInTheDocument();
    expect(within(cool).getByText('Too high')).toHaveClass('pill-late');
  });

  it('logs a reading in °F and stores °C', async () => {
    renderHabitat();
    await userEvent.click(await screen.findByRole('button', { name: 'Log a reading' }));
    const sheet = screen.getByRole('dialog', { name: 'Log habitat reading' });
    await userEvent.type(within(sheet).getByLabelText('Warm side (°F)'), '86');
    await userEvent.type(within(sheet).getByLabelText('Humidity (%)'), '55');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save reading' }));
    await vi.waitFor(async () => expect(await listHabitatReadings(petId)).toHaveLength(8));
    const latest = (await listHabitatReadings(petId)).at(-1)!;
    expect(latest.at).toBe(now.toISOString());
    expect(latest.warmC).toBeCloseTo(30, 6);
    expect(latest.humidityPct).toBe(55);
    expect(latest.coolC).toBeUndefined();
  });

  it('asks for at least one value', async () => {
    renderHabitat();
    await userEvent.click(await screen.findByRole('button', { name: 'Log a reading' }));
    const sheet = screen.getByRole('dialog', { name: 'Log habitat reading' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save reading' }));
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('Enter at least one reading');
  });

  it('a cleared date blocks saving without crashing', async () => {
    renderHabitat();
    await userEvent.click(await screen.findByRole('button', { name: 'Log a reading' }));
    const sheet = screen.getByRole('dialog', { name: 'Log habitat reading' });
    await userEvent.clear(within(sheet).getByLabelText('Date'));
    expect(within(sheet).getByRole('button', { name: 'Save reading' })).toBeDisabled();
  });

  it('edits the enclosure label and targets, keeping untouched targets exact', async () => {
    renderHabitat();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit enclosure & targets' }));
    const sheet = screen.getByRole('dialog', { name: 'Habitat setup' });
    const label = within(sheet).getByLabelText('Enclosure label');
    expect(label).toHaveValue('40-gal tank');
    expect(within(sheet).getByLabelText('Warm side min (°F)')).toHaveValue(85);
    await userEvent.clear(label);
    await userEvent.type(label, '36x18x18 PVC');
    await userEvent.clear(within(sheet).getByLabelText('Warm side max (°F)'));
    await userEvent.type(within(sheet).getByLabelText('Warm side max (°F)'), '92');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save setup' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const pet = (await getPet(petId))!;
    expect(pet.enclosureLabel).toBe('36x18x18 PVC');
    expect(pet.habitatTargets.warmMaxC).toBeCloseTo(f(92), 6);
    expect(pet.habitatTargets.warmMinC).toBe(f(85));
    expect(pet.habitatTargets.humidityMin).toBe(40);
    expect(await screen.findByText('Target 85–92°F')).toBeInTheDocument();
  });

  it('rejects a minimum above the maximum', async () => {
    renderHabitat();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit enclosure & targets' }));
    const sheet = screen.getByRole('dialog', { name: 'Habitat setup' });
    await userEvent.clear(within(sheet).getByLabelText('Warm side min (°F)'));
    await userEvent.type(within(sheet).getByLabelText('Warm side min (°F)'), '95');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save setup' }));
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('Warm side minimum must not be above the maximum');
  });

  it('handles a pet with no setup and no readings', async () => {
    const bare = await createPet({ name: 'Ziggy', species: 'Leopard Gecko', feedingIntervalDays: 3 });
    renderHabitat(bare.id);
    expect(await screen.findByText('No enclosure label · no readings yet')).toBeInTheDocument();
    expect(screen.getAllByText('No target set')).toHaveLength(3);
    expect(screen.getByText('No warm-side readings this week')).toBeInTheDocument();
  });

  it('is routed at /pets/:id/habitat', async () => {
    renderAt(`/pets/${petId}/habitat`);
    expect(await screen.findByRole('heading', { name: 'Habitat' })).toBeInTheDocument();
  });
});
