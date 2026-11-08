import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import FeedingHistory from './FeedingHistory';
import { resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { listFeedings, logFeeding } from '../../db/feedings';

const now = new Date(2026, 10, 8, 9, 0);
let petId: string;

beforeEach(async () => {
  await resetDb();
  const p = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });
  petId = p.id;
  await logFeeding({ petId, at: new Date(2026, 10, 2, 18, 0).toISOString(), foodItem: 'Pinky mouse', quantity: 1, outcome: 'refused' });
  await logFeeding({ petId, at: new Date(2026, 10, 3, 18, 5).toISOString(), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate', notes: 'Struck right away' });
});

function renderHistory() {
  return render(
    <MemoryRouter initialEntries={[`/pets/${petId}/feedings`]}>
      <Routes>
        <Route path="/pets/:id/feedings" element={<FeedingHistory now={now} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('FeedingHistory', () => {
  it('shows the month with food icons and lists entries newest first', async () => {
    renderHistory();
    expect(await screen.findByRole('heading', { name: 'Feedings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'November 3: ate' })).toHaveTextContent('3🐭');
    const items = screen.getAllByRole('article');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Tue, Nov 3 · 6:05 PM');
    expect(items[0]).toHaveTextContent('1 Pinky mouse · Ate it');
    expect(items[0]).toHaveTextContent('Struck right away');
    expect(items[1]).toHaveTextContent('Refused');
  });

  it('filters to a tapped day', async () => {
    renderHistory();
    await userEvent.click(await screen.findByRole('button', { name: 'November 2: refused' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText('Mon, Nov 2')).toBeInTheDocument();
  });

  it('edits a feeding', async () => {
    renderHistory();
    const first = (await screen.findAllByRole('article'))[0]!;
    await userEvent.click(within(first).getByRole('button', { name: 'Edit' }));
    const sheet = screen.getByRole('dialog', { name: 'Edit feeding' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Increase quantity' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save changes' }));
    await vi.waitFor(async () => expect((await listFeedings(petId)).at(-1)!.quantity).toBe(2));
  });

  it('deletes a feeding after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderHistory();
    const second = (await screen.findAllByRole('article'))[1]!;
    await userEvent.click(within(second).getByRole('button', { name: 'Delete' }));
    await vi.waitFor(async () => expect(await listFeedings(petId)).toHaveLength(1));
  });
});
