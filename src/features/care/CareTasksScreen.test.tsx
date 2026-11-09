import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CareTasksScreen from './CareTasksScreen';
import { db, resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { createCareTask, listCareTasks, listCompletions, type CareTaskInput } from '../../db/care';
import { renderAt } from '../../test/render';

const now = new Date(2026, 10, 8, 9, 0);
let noodle: string;

beforeEach(async () => {
  await resetDb();
  noodle = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** A task "created" on a fixed day, so its due date doesn't depend on the real clock. */
async function taskCreatedOn(input: CareTaskInput, day: number) {
  const t = await createCareTask(input);
  await db.careTasks.update(t.id, { createdAt: new Date(2026, 10, day, 9, 0).toISOString() });
  return t;
}

function renderCare() {
  return render(
    <MemoryRouter initialEntries={[`/pets/${noodle}/care`]}>
      <Routes>
        <Route path="/pets/:id/care" element={<CareTasksScreen now={now} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CareTasksScreen', () => {
  it('offers the starter suggestions and adds one with a tap', async () => {
    renderCare();
    expect(await screen.findByRole('heading', { name: 'Care tasks' })).toBeInTheDocument();
    for (const chip of ['+ Spot clean (daily)', '+ Fresh water (every 2 days)', '+ Mist (every 2 days)', '+ Deep clean (every 30 days)', '+ Replace UVB bulb (every 180 days)']) {
      expect(screen.getByRole('button', { name: chip })).toBeInTheDocument();
    }
    await userEvent.click(screen.getByRole('button', { name: '+ Spot clean (daily)' }));
    expect(await screen.findByRole('article', { name: 'Spot clean' })).toBeInTheDocument();
    await vi.waitFor(() => expect(screen.queryByRole('button', { name: '+ Spot clean (daily)' })).toBeNull());
    expect(await listCareTasks(noodle)).toMatchObject([{ name: 'Spot clean', intervalDays: 1, petId: noodle }]);
  });

  it('checks a task off for today and can undo it', async () => {
    const t = await taskCreatedOn({ petId: noodle, name: 'Spot clean', intervalDays: 1 }, 6);
    renderCare();
    const card = await screen.findByRole('article', { name: 'Spot clean' });
    expect(within(card).getByText('1 day late')).toHaveClass('pill-late');

    await userEvent.click(within(card).getByRole('button', { name: 'Spot clean done today' }));
    expect(await within(card).findByText('Tomorrow')).toHaveClass('pill-ok');
    expect(within(card).getByRole('button', { name: 'Spot clean done today' })).toHaveAttribute('aria-pressed', 'true');
    expect((await listCompletions(t.id)).map((c) => c.at)).toEqual([now.toISOString()]);

    await userEvent.click(within(card).getByRole('button', { name: 'Spot clean done today' }));
    expect(await within(card).findByText('1 day late')).toBeInTheDocument();
    expect(await listCompletions(t.id)).toEqual([]);
  });

  it('ignores a double tap on the check button', async () => {
    const t = await taskCreatedOn({ petId: noodle, name: 'Spot clean', intervalDays: 1 }, 6);
    renderCare();
    const check = within(await screen.findByRole('article', { name: 'Spot clean' })).getByRole('button', { name: 'Spot clean done today' });
    fireEvent.click(check);
    fireEvent.click(check);
    expect(await within(await screen.findByRole('article', { name: 'Spot clean' })).findByText('Tomorrow')).toBeInTheDocument();
    expect(await listCompletions(t.id)).toHaveLength(1);
  });

  it('adds a custom task for all pets with a time of day', async () => {
    renderCare();
    await userEvent.click(await screen.findByRole('button', { name: 'New care task' }));
    const sheet = screen.getByRole('dialog', { name: 'New care task' });
    await userEvent.type(within(sheet).getByLabelText('Name'), 'Check temps');
    fireEvent.change(within(sheet).getByLabelText('Time of day'), { target: { value: '08:00' } });
    await userEvent.click(within(sheet).getByRole('radio', { name: 'All pets' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save task' }));
    const card = await screen.findByRole('article', { name: 'Check temps' });
    expect(card).toHaveTextContent('Daily · 8:00 AM · All pets');
    const [saved] = await listCareTasks();
    expect(saved).toMatchObject({ name: 'Check temps', intervalDays: 1, timeOfDay: '08:00' });
    expect(saved!.petId).toBeUndefined();
  });

  it('clears a time of day again (iOS time inputs have no clear control)', async () => {
    const t = await createCareTask({ petId: noodle, name: 'Check temps', intervalDays: 1, timeOfDay: '08:00' });
    renderCare();
    await userEvent.click(within(await screen.findByRole('article', { name: 'Check temps' })).getByRole('button', { name: 'Edit' }));
    const sheet = screen.getByRole('dialog', { name: 'Edit care task' });
    expect(within(sheet).getByLabelText('Time of day')).toHaveValue('08:00');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Clear time' }));
    expect(within(sheet).getByLabelText('Time of day')).toHaveValue('');
    expect(within(sheet).queryByRole('button', { name: 'Clear time' })).toBeNull();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save task' }));
    await vi.waitFor(async () => expect((await db.careTasks.get(t.id))!.timeOfDay).toBeUndefined());
  });

  it('blocks an out-of-range repeat with an inline reason and does not crash', async () => {
    renderCare();
    await userEvent.click(await screen.findByRole('button', { name: 'New care task' }));
    const sheet = screen.getByRole('dialog', { name: 'New care task' });
    await userEvent.type(within(sheet).getByLabelText('Name'), 'Mist');
    await userEvent.clear(within(sheet).getByLabelText('Repeat every (days)'));
    await userEvent.type(within(sheet).getByLabelText('Repeat every (days)'), '999999999');
    expect(within(sheet).getByText('Repeat every must be a whole number from 1 to 3650 days.')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Save task' })).toBeDisabled();
    expect(await listCareTasks()).toHaveLength(0);
    fireEvent.change(within(sheet).getByLabelText('Repeat every (days)'), { target: { value: '3650' } });
    expect(within(sheet).getByRole('button', { name: 'Save task' })).toBeEnabled();
  });

  it('shows All-pets tasks on every pet', async () => {
    await createCareTask({ name: 'Fresh water', intervalDays: 2 });
    renderCare();
    expect(await screen.findByRole('article', { name: 'Fresh water' })).toHaveTextContent('Every 2 days · All pets');
  });

  it('edits a task, then removes it', async () => {
    const t = await createCareTask({ petId: noodle, name: 'Mist', intervalDays: 2 });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderCare();
    await userEvent.click(within(await screen.findByRole('article', { name: 'Mist' })).getByRole('button', { name: 'Edit' }));
    let sheet = screen.getByRole('dialog', { name: 'Edit care task' });
    await userEvent.clear(within(sheet).getByLabelText('Name'));
    await userEvent.type(within(sheet).getByLabelText('Name'), 'Mist humid hide');
    await userEvent.clear(within(sheet).getByLabelText('Repeat every (days)'));
    await userEvent.type(within(sheet).getByLabelText('Repeat every (days)'), '3');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save task' }));
    const card = await screen.findByRole('article', { name: 'Mist humid hide' });
    expect(card).toHaveTextContent('Every 3 days');

    await userEvent.click(within(card).getByRole('button', { name: 'Edit' }));
    sheet = screen.getByRole('dialog', { name: 'Edit care task' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Remove task' }));
    await vi.waitFor(() => expect(screen.queryByRole('article', { name: 'Mist humid hide' })).toBeNull());
    expect((await db.careTasks.get(t.id))!.archivedAt).toBeDefined();
  });

  it('needs a name', async () => {
    renderCare();
    await userEvent.click(await screen.findByRole('button', { name: 'New care task' }));
    const sheet = screen.getByRole('dialog', { name: 'New care task' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save task' }));
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('Name the task');
  });

  it('is routed at /pets/:id/care', async () => {
    renderAt(`/pets/${noodle}/care`);
    expect(await screen.findByRole('heading', { name: 'Care tasks' })).toBeInTheDocument();
  });
});
