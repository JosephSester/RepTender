import type { Settings } from '../domain/types';
import { db, DEFAULT_SETTINGS } from './db';

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('settings')) ?? DEFAULT_SETTINGS;
}

/** Read-modify-write in one transaction, so quick taps on different pickers never undo each other. */
export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = await getSettings();
    await db.settings.put({ ...current, ...patch, id: 'settings' });
  });
}
