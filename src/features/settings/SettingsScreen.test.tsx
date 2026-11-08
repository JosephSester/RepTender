import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SettingsScreen from './SettingsScreen';
import { resetDb } from '../../db/db';
import { getSettings } from '../../db/settings';
import { listActivePets } from '../../db/pets';

beforeEach(async () => {
  await resetDb();
});

const renderSettings = () => render(<MemoryRouter><SettingsScreen /></MemoryRouter>);

it('switches appearance', async () => {
  renderSettings();
  const auto = await screen.findByRole('radio', { name: 'Auto' });
  expect(auto).toHaveAttribute('aria-checked', 'true');
  await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
  await vi.waitFor(async () => expect((await getSettings()).theme).toBe('dark'));
  expect(await screen.findByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
});

it('loads sample pets in development builds', async () => {
  renderSettings();
  await userEvent.click(await screen.findByRole('button', { name: 'Load sample pets' }));
  await vi.waitFor(async () => expect(await listActivePets()).toHaveLength(4));
});
