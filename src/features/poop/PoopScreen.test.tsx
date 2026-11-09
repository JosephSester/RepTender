import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PoopScreen from './PoopScreen';
import { resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { logFeeding } from '../../db/feedings';
import { listPoops, logPoop } from '../../db/poops';
import { renderAt } from '../../test/render';

const now = new Date(2026, 10, 8, 9, 0);
const t = (m: number, d: number, h = 18) => new Date(2026, m, d, h, 0).toISOString();
let petId: string;

beforeEach(async () => {
  await resetDb();
  petId = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
  await logFeeding({ petId, at: t(9, 22), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate' });
  await logFeeding({ petId, at: t(10, 3), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate' });
  await logPoop({ petId, at: t(9, 26, 9), kind: 'normal' });
  await logPoop({ petId, at: t(10, 6, 8), kind: 'normal', notes: 'Big one' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderPoop() {
  return render(
    <MemoryRouter initialEntries={[`/pets/${petId}/poop`]}>
      <Routes>
        <Route path="/pets/:id/poop" element={<PoopScreen now={now} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PoopScreen', () => {
  it('shows the last poop, the typical gap and a labelled history', async () => {
    renderPoop();
    expect(await screen.findByRole('heading', { name: 'Poop log' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '‹ Noodle' })).toHaveAttribute('href', `/pets/${petId}`);
    expect(screen.getByText('Fri, Nov 6 · 2 days ago')).toBeInTheDocument();
    expect(screen.getByText('Usually 3–4 days after a meal')).toBeInTheDocument();
    const items = await screen.findAllByRole('article');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Nov 6 · 3 days after Nov 3 meal');
    expect(items[0]).toHaveTextContent('Big one');
    expect(items[1]).toHaveTextContent('Oct 26 · 4 days after Oct 22 meal');
  });

  it('logs a poop in one tap with the chosen kind', async () => {
    renderPoop();
    await userEvent.click(await screen.findByRole('radio', { name: 'Runny' }));
    await userEvent.click(screen.getByRole('button', { name: 'Log poop now' }));
    await vi.waitFor(async () => expect(await listPoops(petId)).toHaveLength(3));
    expect((await listPoops(petId)).at(-1)).toMatchObject({ kind: 'runny', at: now.toISOString() });
  });

  it('logs an earlier poop from the sheet', async () => {
    renderPoop();
    await userEvent.click(await screen.findByRole('button', { name: 'Log poop' }));
    const sheet = screen.getByRole('dialog', { name: 'Log poop' });
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Abnormal' }));
    fireEvent.change(within(sheet).getByLabelText('Date'), { target: { value: '2026-11-07' } });
    await userEvent.type(within(sheet).getByLabelText('Notes'), 'Mucus');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save poop' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((await listPoops(petId)).at(-1)).toMatchObject({
      kind: 'abnormal', notes: 'Mucus', at: new Date(2026, 10, 7, 9, 0).toISOString(),
    });
  });

  it('a cleared date in the sheet blocks saving without crashing', async () => {
    renderPoop();
    await userEvent.click(await screen.findByRole('button', { name: 'Log poop' }));
    const sheet = screen.getByRole('dialog', { name: 'Log poop' });
    await userEvent.clear(within(sheet).getByLabelText('Date'));
    expect(within(sheet).getByRole('button', { name: 'Save poop' })).toBeDisabled();
  });

  it('deletes an entry after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPoop();
    const [first] = await screen.findAllByRole('article');
    await userEvent.click(within(first!).getByRole('button', { name: 'Delete' }));
    await vi.waitFor(async () => expect(await listPoops(petId)).toHaveLength(1));
  });

  it('is routed at /pets/:id/poop', async () => {
    renderAt(`/pets/${petId}/poop`);
    expect(await screen.findByRole('heading', { name: 'Poop log' })).toBeInTheDocument();
  });

  it('says when the pet does not exist', async () => {
    renderAt('/pets/missing/poop');
    expect(await screen.findByText('Pet not found')).toBeInTheDocument();
  });
});
