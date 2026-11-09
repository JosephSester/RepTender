import { beforeEach, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PetForm from './PetForm';
import { db, resetDb } from '../../db/db';

beforeEach(async () => {
  await resetDb();
});

it('refuses a feeding interval over 365 days with an inline reason', async () => {
  render(
    <MemoryRouter initialEntries={['/pets/new']}>
      <Routes>
        <Route path="/pets/new" element={<PetForm />} />
      </Routes>
    </MemoryRouter>,
  );
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Name'), 'Noodle');
  await user.type(screen.getByLabelText('Species'), 'Corn Snake');
  const interval = screen.getByLabelText('Feed every (days)');
  expect(interval).toHaveAttribute('max', '365');
  await user.clear(interval);
  await user.type(interval, '999999999');
  await user.click(screen.getByRole('button', { name: 'Save pet' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Feed every must be 1 to 365 days');
  expect(await db.pets.count()).toBe(0);
});
