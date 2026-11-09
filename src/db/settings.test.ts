import { beforeEach, expect, it } from 'vitest';
import { resetDb } from './db';
import { getSettings, updateSettings } from './settings';

beforeEach(async () => {
  await resetDb();
});

it('overlapping updates keep every change (no lost update)', async () => {
  await Promise.all([
    updateSettings({ tempUnit: 'C' }),
    updateSettings({ weightUnit: 'oz' }),
    updateSettings({ lengthUnit: 'cm' }),
    updateSettings({ theme: 'dark' }),
  ]);
  expect(await getSettings()).toMatchObject({ tempUnit: 'C', weightUnit: 'oz', lengthUnit: 'cm', theme: 'dark' });
});
