import { beforeEach, expect, it, vi } from 'vitest';
import { render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SettingsScreen from './SettingsScreen';
import { useUnits } from './useUnits';
import { resetDb } from '../../db/db';
import { getSettings } from '../../db/settings';
import { formatWeight } from '../../domain/units';

beforeEach(async () => {
  await resetDb();
});

const renderSettings = () => render(<MemoryRouter><SettingsScreen /></MemoryRouter>);
const radio = (group: string, name: string) =>
  within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', { name });

it('shows the stored units, °F · g · in by default', async () => {
  renderSettings();
  const card = await screen.findByRole('group', { name: 'Units' });
  expect(within(card).getAllByRole('radiogroup').map((g) => g.getAttribute('aria-label'))).toEqual([
    'Temperature', 'Weight', 'Length',
  ]);
  expect(radio('Temperature', '°F')).toHaveAttribute('aria-checked', 'true');
  expect(radio('Weight', 'g')).toHaveAttribute('aria-checked', 'true');
  expect(radio('Length', 'in')).toHaveAttribute('aria-checked', 'true');
});

it('saves each unit, and screens reading useUnits follow', async () => {
  renderSettings();
  const units = renderHook(() => useUnits());
  await userEvent.click(await screen.findByRole('radio', { name: '°C' }));
  await userEvent.click(screen.getByRole('radio', { name: 'oz' }));
  await userEvent.click(screen.getByRole('radio', { name: 'cm' }));
  await vi.waitFor(async () =>
    expect(await getSettings()).toMatchObject({ tempUnit: 'C', weightUnit: 'oz', lengthUnit: 'cm' }),
  );
  await waitFor(() => expect(radio('Weight', 'oz')).toHaveAttribute('aria-checked', 'true'));
  await waitFor(() => expect(units.result.current).toEqual({ temp: 'C', weight: 'oz', length: 'cm' }));
  expect(formatWeight(42, units.result.current!.weight)).toBe('1.5 oz');

  await userEvent.click(screen.getByRole('radio', { name: 'lb' }));
  await vi.waitFor(async () => expect((await getSettings()).weightUnit).toBe('lb'));
});
