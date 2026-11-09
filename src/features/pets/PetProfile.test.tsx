import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PetProfile from './PetProfile';
import { resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { logFeeding } from '../../db/feedings';
import { logShed } from '../../db/sheds';
import { logPoop } from '../../db/poops';
import { logMeasurement } from '../../db/measurements';
import { logHabitatReading } from '../../db/habitat';
import { completeCareTask, createCareTask } from '../../db/care';
import { createVetVisit } from '../../db/vetVisits';
import { addNote } from '../../db/notes';
import { tempToC } from '../../domain/units';

const now = new Date(2026, 10, 8, 9, 0);
const at = (d: number) => new Date(2026, 10, d, 18, 0).toISOString();

function renderProfile(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/pets/${id}`]}>
      <Routes>
        <Route path="/pets/:id" element={<PetProfile now={now} />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await resetDb();
});

describe('PetProfile', () => {
  it('shows the pet, next feeding, calendar and details', async () => {
    const p = await createPet({
      name: 'Noodle', species: 'Corn Snake', morph: 'Amel', sex: 'female', origin: 'captive_bred',
      birthDate: '2026-03-03', feedingIntervalDays: 5, usualFoodItem: 'Pinky mouse',
      sire: { name: 'Apollo', morph: 'Amel' }, dam: { name: 'Juniper', morph: 'Anery' },
      acquiredFrom: 'Scales & Tails Reptiles', acquiredDate: '2026-04-12', pricePaid: 65,
      description: 'Calm, great eater.',
    });
    await logFeeding({ petId: p.id, at: at(2), foodItem: 'Pinky mouse', quantity: 1, outcome: 'refused' });
    await logFeeding({ petId: p.id, at: at(3), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate' });
    renderProfile(p.id);

    expect(await screen.findByRole('heading', { name: 'Noodle' })).toBeInTheDocument();
    expect(screen.getByText('Corn Snake · Amel')).toBeInTheDocument();
    expect(screen.getByText('♀ Female')).toBeInTheDocument();
    expect(screen.getAllByText('8 mo')).toHaveLength(2); // age chip + Age stat
    expect(screen.getByText('Captive bred')).toBeInTheDocument();

    expect(screen.getByText('Today · 6:00 PM')).toBeInTheDocument();
    expect(screen.getByText('Every 5 days · 1 Pinky mouse')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'November 3: ate' })).toHaveClass('is-ate');
    expect(screen.getByRole('button', { name: 'November 2: refused' })).toHaveClass('is-refused');
    expect(screen.getByRole('button', { name: 'November 8: next feeding due, today' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'November 13: planned feeding' })).toHaveClass('is-planned');
    expect(screen.getByText('1 meal · 1 refusal this month')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See all ›' })).toHaveAttribute('href', `/pets/${p.id}/feedings`);
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', `/pets/${p.id}/edit`);

    expect(screen.getByText('Apollo · Amel')).toBeInTheDocument();
    expect(screen.getByText('Juniper · Anery')).toBeInTheDocument();
    expect(screen.getByText('Scales & Tails Reptiles')).toBeInTheDocument();
    expect(screen.getByText('Bought Apr 12, 2026 · $65')).toBeInTheDocument();
    expect(screen.getByText('Calm, great eater.')).toBeInTheDocument();
  });

  it('moves between months', async () => {
    const p = await createPet({ name: 'Ziggy', species: 'Leopard Gecko', feedingIntervalDays: 3 });
    renderProfile(p.id);
    await screen.findByText('November 2026');
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(await screen.findByText('October 2026')).toBeInTheDocument();
  });

  it('says when a pet does not exist', async () => {
    renderProfile('missing');
    expect(await screen.findByText('Pet not found')).toBeInTheDocument();
  });

  it('the Quick log row opens the Fed, Regurg., Poop and Shed sheets', async () => {
    const p = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });
    renderProfile(p.id);
    const pairs: [string, string][] = [
      ['Fed', 'Feed Noodle'],
      ['Regurg.', 'Log regurgitation'],
      ['Poop', 'Log poop'],
      ['Shed', 'Log shed'],
    ];
    for (const [button, dialog] of pairs) {
      await userEvent.click(await screen.findByRole('button', { name: button }));
      expect(screen.getByRole('dialog', { name: dialog })).toBeInTheDocument();
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).toBeNull();
    }
  });

  it('shows husbandry tiles with summaries, and the latest length and weight', async () => {
    const p = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });
    await logShed({ petId: p.id, date: '2026-10-21', quality: 'complete' });
    await logPoop({ petId: p.id, at: new Date(2026, 10, 6, 8, 0).toISOString(), kind: 'normal' });
    await logMeasurement({ petId: p.id, date: '2026-10-01', weightG: 39 });
    await logMeasurement({ petId: p.id, date: '2026-11-01', weightG: 42, lengthMm: 457.2 });
    await logHabitatReading({ petId: p.id, at: new Date(2026, 10, 8, 8, 15).toISOString(), warmC: tempToC(88, 'F'), humidityPct: 52 });
    const task = await createCareTask({ petId: p.id, name: 'Spot clean', intervalDays: 1 });
    await completeCareTask(task.id, new Date(2026, 10, 7, 9, 0).toISOString());
    await createVetVisit({ petId: p.id, date: '2026-06-14', reason: 'Wellness exam' });
    for (const d of [1, 2, 3]) await addNote({ petId: p.id, at: at(d), text: `Note ${d}` });
    renderProfile(p.id);

    const tiles: [RegExp, string, string][] = [
      [/^Sheds/, 'sheds', 'Last: Oct 21 · complete'],
      [/^Poop/, 'poop', 'Last: Nov 6 · normal'],
      [/^Weight/, 'weight', '42 g · ↑ 3 g'],
      [/^Habitat/, 'habitat', '88°F · 52% RH'],
      [/^Care tasks/, 'care', '1 due today'],
      [/^Vet visits/, 'vet', 'Jun 14 · Wellness exam'],
      [/^Notes/, 'notes', '3 notes'],
    ];
    for (const [name, path, summary] of tiles) {
      const link = await screen.findByRole('link', { name });
      expect(link).toHaveAttribute('href', `/pets/${p.id}/${path}`);
      expect(within(link).getByText(summary)).toBeInTheDocument();
    }
    expect(screen.getByText('18 in')).toBeInTheDocument();
    expect(screen.getByText('42 g')).toBeInTheDocument();
  });
});
