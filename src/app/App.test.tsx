import { beforeEach, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
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
