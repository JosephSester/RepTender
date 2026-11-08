import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import PetForm from './PetForm';
import { db, resetDb } from '../../db/db';
import { createPet, getPet } from '../../db/pets';

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

  it('deletes a pet after confirmation', async () => {
    const p = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderForm(`/pets/${p.id}/edit`);
    await screen.findByDisplayValue('Noodle');
    await userEvent.click(screen.getByRole('button', { name: 'Delete pet' }));
    expect(await screen.findByText('home')).toBeInTheDocument();
    expect(await getPet(p.id)).toBeUndefined();
  });
});
