import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ShedsScreen from './ShedsScreen';
import { resetDb } from '../../db/db';
import { createPet, getPet } from '../../db/pets';
import { listSheds, logShed } from '../../db/sheds';
import { renderAt } from '../../test/render';

const now = new Date(2026, 10, 8, 9, 0);
let petId: string;

beforeEach(async () => {
  await resetDb();
  petId = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function threeSheds() {
  await logShed({ petId, date: '2026-08-16', quality: 'partial', notes: 'Stuck on the tail tip, soaked 15 min' });
  await logShed({ petId, date: '2026-09-18', quality: 'complete' });
  await logShed({ petId, date: '2026-10-21', quality: 'complete', inBlueDate: '2026-10-14' });
}

function renderSheds() {
  return render(
    <MemoryRouter initialEntries={[`/pets/${petId}/sheds`]}>
      <Routes>
        <Route path="/pets/:id/sheds" element={<ShedsScreen now={now} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ShedsScreen', () => {
  it('predicts the next shed and lists the history newest first', async () => {
    await threeSheds();
    renderSheds();
    expect(await screen.findByText('Around Nov 23')).toBeInTheDocument();
    expect(screen.getByText('Sheds every ~33 days')).toBeInTheDocument();
    expect(screen.getByText('In 15 days')).toHaveClass('pill-ok');
    const items = screen.getAllByRole('article');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Oct 21, 2026');
    expect(items[0]).toHaveTextContent('Complete · in blue Oct 14');
    expect(items[2]).toHaveTextContent('Aug 16, 2026');
    expect(within(items[2]!).getByText('Partial', { selector: '.pill' })).toHaveClass('pill-due');
    expect(items[2]).toHaveTextContent('Stuck on the tail tip, soaked 15 min');
  });

  it('shows no prediction before 2 sheds', async () => {
    await logShed({ petId, date: '2026-10-21', quality: 'complete' });
    renderSheds();
    expect(await screen.findByRole('article')).toBeInTheDocument();
    expect(screen.queryByText('Next shed expected')).toBeNull();
    expect(screen.queryByRole('button', { name: /in blue/ })).toBeNull();
  });

  it('marks "in blue", then the logged shed keeps that date and clears the mark', async () => {
    await threeSheds();
    renderSheds();
    await userEvent.click(await screen.findByRole('button', { name: 'Mark "in blue" (eyes cloudy)' }));
    expect(await screen.findByText('In blue since Nov 8')).toBeInTheDocument();
    expect((await getPet(petId))!.inBlueSince).toBe('2026-11-08');

    await userEvent.click(screen.getByRole('button', { name: 'Log shed' }));
    const sheet = screen.getByRole('dialog', { name: 'Log shed' });
    expect(within(sheet).getByLabelText('Went into blue')).toHaveValue('2026-11-08');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save shed' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((await listSheds(petId)).at(-1)).toMatchObject({ date: '2026-11-08', inBlueDate: '2026-11-08', quality: 'complete' });
    expect((await getPet(petId))!.inBlueSince).toBeUndefined();
  });

  it('can take the "in blue" mark back', async () => {
    await threeSheds();
    renderSheds();
    await userEvent.click(await screen.findByRole('button', { name: 'Mark "in blue" (eyes cloudy)' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Not in blue' }));
    expect(await screen.findByRole('button', { name: 'Mark "in blue" (eyes cloudy)' })).toBeInTheDocument();
    expect((await getPet(petId))!.inBlueSince).toBeUndefined();
  });

  it('logs a stuck shed with notes and rejects an in-blue date after the shed', async () => {
    renderSheds();
    await userEvent.click(await screen.findByRole('button', { name: 'Log shed' }));
    const sheet = screen.getByRole('dialog', { name: 'Log shed' });
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Stuck' }));
    fireEvent.change(within(sheet).getByLabelText('Went into blue'), { target: { value: '2026-11-09' } });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save shed' }));
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('on or before the shed date');

    fireEvent.change(within(sheet).getByLabelText('Went into blue'), { target: { value: '' } });
    await userEvent.type(within(sheet).getByLabelText('Notes'), 'Eye caps stuck');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save shed' }));
    await vi.waitFor(async () => expect(await listSheds(petId)).toHaveLength(1));
    expect((await listSheds(petId))[0]).toMatchObject({ quality: 'stuck', notes: 'Eye caps stuck', date: '2026-11-08' });
  });

  it('a cleared shed date blocks saving without crashing', async () => {
    renderSheds();
    await userEvent.click(await screen.findByRole('button', { name: 'Log shed' }));
    const sheet = screen.getByRole('dialog', { name: 'Log shed' });
    await userEvent.clear(within(sheet).getByLabelText('Shed date'));
    expect(within(sheet).getByRole('button', { name: 'Save shed' })).toBeDisabled();
  });

  it('deletes a shed after confirmation', async () => {
    await threeSheds();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderSheds();
    const [first] = await screen.findAllByRole('article');
    await userEvent.click(within(first!).getByRole('button', { name: 'Delete' }));
    await vi.waitFor(async () => expect(await listSheds(petId)).toHaveLength(2));
  });

  it('is routed at /pets/:id/sheds', async () => {
    renderAt(`/pets/${petId}/sheds`);
    expect(await screen.findByRole('heading', { name: 'Sheds' })).toBeInTheDocument();
  });
});
