import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import PetForm from './PetForm';
import { db, resetDb } from '../../db/db';
import { createPet, getPet, listActivePets } from '../../db/pets';

function ProfileStub() {
  const { id } = useParams();
  return <div>profile {id}</div>;
}

function renderForm(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<div>home</div>} />
        <Route path="/pets/new" element={<PetForm />} />
        <Route path="/pets/:id" element={<ProfileStub />} />
        <Route path="/pets/:id/edit" element={<PetForm />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await resetDb();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PetForm', () => {
  it('adds a pet and opens its profile', async () => {
    renderForm('/pets/new');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Name'), 'Noodle');
    await user.type(screen.getByLabelText('Species'), 'Corn Snake');
    await user.type(screen.getByLabelText('Morph / breed'), 'Amel');
    await user.selectOptions(screen.getByLabelText('Sex'), 'female');
    await user.clear(screen.getByLabelText('Feed every (days)'));
    await user.type(screen.getByLabelText('Feed every (days)'), '5');
    await screen.findByRole('option', { name: 'Pinky mouse' }); // food list loads from the DB
    await user.selectOptions(screen.getByLabelText('Usual food'), 'Pinky mouse');
    await user.type(screen.getByLabelText('Sire name'), 'Apollo');
    await user.type(screen.getByLabelText('Bought from'), 'Scales & Tails Reptiles');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const text = (await screen.findByText(/^profile /)).textContent!;
    const pet = (await getPet(text.replace('profile ', '')))!;
    expect(pet).toMatchObject({
      name: 'Noodle', species: 'Corn Snake', morph: 'Amel', sex: 'female', feedingIntervalDays: 5,
      usualFoodItem: 'Pinky mouse', usualQuantity: 1, usualFeedTime: '18:00',
      sire: { name: 'Apollo' }, acquiredFrom: 'Scales & Tails Reptiles',
    });
    expect(pet.dam).toBeUndefined();
  });

  it('shows validation errors and saves nothing', async () => {
    renderForm('/pets/new');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Species'), 'Corn Snake');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Name is required');
    expect(await db.pets.count()).toBe(0);
  });

  it('edits a pet and clears emptied fields', async () => {
    const p = await createPet({ name: 'Noodle', species: 'Corn Snake', morph: 'Amel', feedingIntervalDays: 5 });
    renderForm(`/pets/${p.id}/edit`);
    const user = userEvent.setup();
    const morph = await screen.findByLabelText('Morph / breed');
    await screen.findByDisplayValue('Noodle');
    await user.clear(morph);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText(`profile ${p.id}`);
    expect((await getPet(p.id))!.morph).toBeUndefined();
  });

  it('keeps a sire link to another pet when the pet is edited', async () => {
    const apollo = await createPet({ name: 'Apollo', species: 'Corn Snake', feedingIntervalDays: 7 });
    const p = await createPet({
      name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5, sire: { name: 'Apollo', petId: apollo.id },
    });
    renderForm(`/pets/${p.id}/edit`);
    await screen.findByDisplayValue('Noodle');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText(`profile ${p.id}`);
    expect((await getPet(p.id))!.sire).toMatchObject({ name: 'Apollo', petId: apollo.id });
  });

  it('deletes a pet after confirmation', async () => {
    const p = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderForm(`/pets/${p.id}/edit`);
    await screen.findByDisplayValue('Noodle');
    await userEvent.click(screen.getByRole('button', { name: 'Delete pet' }));
    expect(await screen.findByText('home')).toBeInTheDocument();
    expect(await getPet(p.id)).toBeUndefined();
  });

  it('archives a pet only after confirmation', async () => {
    const p = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderForm(`/pets/${p.id}/edit`);
    await screen.findByDisplayValue('Noodle');
    await userEvent.click(screen.getByRole('button', { name: 'Archive pet' }));
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/Archive Noodle\?.*hidden from My Reptiles/));
    expect((await listActivePets()).map((x) => x.id)).toEqual([p.id]);
    expect(screen.queryByText('home')).not.toBeInTheDocument();

    confirm.mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: 'Archive pet' }));
    expect(await screen.findByText('home')).toBeInTheDocument();
    expect(await listActivePets()).toEqual([]);
    expect(await getPet(p.id)).toBeDefined();
  });

  it('moves focus to the error alert when Save fails', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    try {
      renderForm('/pets/new');
      await userEvent.click(await screen.findByRole('button', { name: 'Save pet' }));
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveFocus();
      expect(scroll).toHaveBeenCalled();
    } finally {
      // @ts-expect-error jsdom has no scrollIntoView: remove the stub so later tests see the real jsdom
      delete Element.prototype.scrollIntoView;
    }
  });

  it('re-focuses the alert when the same error happens twice', async () => {
    renderForm('/pets/new');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Name'), 'Noodle');
    await user.type(screen.getByLabelText('Species'), 'Corn Snake');
    fireEvent.change(screen.getByLabelText('Price paid ($)'), { target: { value: '-5' } });
    await user.click(screen.getByRole('button', { name: 'Save pet' }));
    expect(await screen.findByRole('alert')).toHaveFocus();

    await user.click(screen.getByLabelText('Name'));
    expect(screen.getByLabelText('Name')).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Save pet' }));
    await vi.waitFor(() => expect(screen.getByRole('alert')).toHaveFocus());
    expect(screen.getByRole('alert')).toHaveTextContent('Price must be a number');
  });
});
