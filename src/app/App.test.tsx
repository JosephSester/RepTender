import { beforeEach, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderAt } from '../test/render';
import { resetDb } from '../db/db';

beforeEach(async () => {
  await resetDb();
});

it('opens on the Pets home screen with a tab bar', async () => {
  renderAt('/');
  expect(await screen.findByRole('heading', { name: 'My Reptiles' })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
});

it('has the tabs Pets, Schedule, Add, Settings in that order (spec §4)', async () => {
  renderAt('/');
  const nav = await screen.findByRole('navigation', { name: 'Main' });
  expect(within(nav).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/', '/schedule', '/add', '/settings']);
});

it('opens the Add tab', async () => {
  renderAt('/add');
  expect(await screen.findByRole('heading', { name: 'Add' })).toBeInTheDocument();
  expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Add' })).toHaveClass('active');
});
