import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from './ErrorBoundary';
import { resetDb } from '../db/db';
import { createPet } from '../db/pets';
import { getSettings } from '../db/settings';
import { mockShare, unmockShare } from '../test/share';

function Boom(): never {
  throw new Error('kaboom');
}

beforeEach(async () => {
  await resetDb();
  await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });
  vi.spyOn(console, 'error').mockImplementation(() => {}); // React logs the caught error
});

afterEach(() => {
  unmockShare();
  vi.restoreAllMocks();
});

it('renders the app when nothing fails', () => {
  render(<ErrorBoundary><p>All good</p></ErrorBoundary>);
  expect(screen.getByText('All good')).toBeInTheDocument();
});

it('shows a friendly screen with Reload instead of a white screen', async () => {
  const reload = vi.fn();
  render(<ErrorBoundary onReload={reload}><Boom /></ErrorBoundary>);
  expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
  expect(screen.getByText('Your pets and records are still saved on this iPhone.')).toBeInTheDocument();
  expect(screen.getByText('kaboom')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
  expect(reload).toHaveBeenCalledTimes(1);
});

it('can still export a backup after the UI crashed', async () => {
  const { share, file } = mockShare();
  render(<ErrorBoundary onReload={vi.fn()}><Boom /></ErrorBoundary>);
  await userEvent.click(screen.getByRole('button', { name: 'Export backup' }));
  await userEvent.click(await screen.findByRole('button', { name: /^Save backup file/ }));
  await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  const backup = JSON.parse(await file().text());
  expect(backup.tables.pets.map((p: { name: string }) => p.name)).toEqual(['Noodle']);
  expect(await screen.findByRole('status')).toHaveTextContent('Backup saved.');
  expect((await getSettings()).lastBackupAt).toBeDefined();
});
