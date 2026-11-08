import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PetProfile from './PetProfile';
import { resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { logFeeding } from '../../db/feedings';

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
});
