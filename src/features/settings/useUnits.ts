import { useLiveQuery } from 'dexie-react-hooks';
import { getSettings } from '../../db/settings';
import type { Units } from '../../domain/units';

/**
 * The user's display units from Settings (spec §5.15; the picker itself is Plan 3).
 * Undefined until Settings load, so forms never pre-fill values in the wrong unit.
 */
export function useUnits(): Units | undefined {
  const settings = useLiveQuery(() => getSettings(), []);
  if (!settings) return undefined;
  return { temp: settings.tempUnit, weight: settings.weightUnit, length: settings.lengthUnit };
}
