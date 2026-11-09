import { beforeEach, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { resetDb } from '../../db/db';
import { updateSettings } from '../../db/settings';
import { useUnits } from './useUnits';

beforeEach(async () => {
  await resetDb();
});

it('reads the units from Settings: °F, g and in by default', async () => {
  const { result } = renderHook(() => useUnits());
  await waitFor(() => expect(result.current).toEqual({ temp: 'F', weight: 'g', length: 'in' }));
  await updateSettings({ tempUnit: 'C', lengthUnit: 'cm' });
  await waitFor(() => expect(result.current).toEqual({ temp: 'C', weight: 'g', length: 'cm' }));
});
