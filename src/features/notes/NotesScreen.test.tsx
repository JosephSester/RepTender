import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NotesScreen from './NotesScreen';
import { resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { addNote, listNotes } from '../../db/notes';
import { renderAt } from '../../test/render';

const now = new Date(2026, 10, 8, 9, 0);
let petId: string;

beforeEach(async () => {
  await resetDb();
  petId = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
  await addNote({ petId, at: new Date(2026, 10, 2, 19, 0).toISOString(), text: 'Eyes going blue.' });
  await addNote({ petId, at: new Date(2026, 10, 7, 20, 30).toISOString(), text: 'Moved to the 40-gal tank.' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderNotes() {
  return render(
    <MemoryRouter initialEntries={[`/pets/${petId}/notes`]}>
      <Routes>
        <Route path="/pets/:id/notes" element={<NotesScreen now={now} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NotesScreen', () => {
  it('lists notes newest first with their dates', async () => {
    renderNotes();
    const items = await screen.findAllByRole('article');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Sat, Nov 7, 2026 · 8:30 PM');
    expect(items[0]).toHaveTextContent('Moved to the 40-gal tank.');
    expect(items[1]).toHaveTextContent('Eyes going blue.');
  });

  it('adds a note', async () => {
    renderNotes();
    await userEvent.click(await screen.findByRole('button', { name: 'New note' }));
    const sheet = screen.getByRole('dialog', { name: 'New note' });
    await userEvent.type(within(sheet).getByLabelText('Note'), 'Ate a bit slower than usual.');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save note' }));
    await vi.waitFor(async () => expect(await listNotes(petId)).toHaveLength(3));
    expect((await listNotes(petId)).at(-1)).toMatchObject({ text: 'Ate a bit slower than usual.', at: now.toISOString() });
  });

  it('edits a note', async () => {
    renderNotes();
    const [first] = await screen.findAllByRole('article');
    await userEvent.click(within(first!).getByRole('button', { name: 'Edit' }));
    const sheet = screen.getByRole('dialog', { name: 'Edit note' });
    const text = within(sheet).getByLabelText('Note');
    expect(text).toHaveValue('Moved to the 40-gal tank.');
    await userEvent.type(text, ' Settled in fine.');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save note' }));
    await vi.waitFor(async () => expect((await listNotes(petId)).at(-1)!.text).toBe('Moved to the 40-gal tank. Settled in fine.'));
    // The list re-renders from its live query after the save, so wait for the settled DOM.
    await vi.waitFor(() => expect(screen.getByText('Moved to the 40-gal tank. Settled in fine.')).toBeInTheDocument());
  });

  it('needs some text, and a cleared date blocks saving', async () => {
    renderNotes();
    await userEvent.click(await screen.findByRole('button', { name: 'New note' }));
    const sheet = screen.getByRole('dialog', { name: 'New note' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save note' }));
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('Write something first');
    await userEvent.clear(within(sheet).getByLabelText('Date'));
    expect(within(sheet).getByRole('button', { name: 'Save note' })).toBeDisabled();
  });

  it('deletes a note after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderNotes();
    const [first] = await screen.findAllByRole('article');
    await userEvent.click(within(first!).getByRole('button', { name: 'Delete' }));
    await vi.waitFor(async () => expect(await listNotes(petId)).toHaveLength(1));
  });

  it('is routed at /pets/:id/notes', async () => {
    renderAt(`/pets/${petId}/notes`);
    expect(await screen.findByRole('heading', { name: 'Notes' })).toBeInTheDocument();
  });
});
