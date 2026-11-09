import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { subDays } from 'date-fns';
import SettingsScreen from '../settings/SettingsScreen';
import { db, resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { logFeeding } from '../../db/feedings';
import { getSettings, updateSettings } from '../../db/settings';
import { createBackup } from '../../db/backup';
import { mockShare, stubObjectUrls, unmockShare } from '../../test/share';

beforeEach(async () => {
  await resetDb();
});

afterEach(() => {
  unmockShare();
  delete (navigator as { storage?: unknown }).storage;
  vi.restoreAllMocks();
});

const renderSettings = () => render(<MemoryRouter><SettingsScreen /></MemoryRouter>);
const card = () => screen.findByRole('group', { name: 'Reminders & data' });

async function backupText(): Promise<string> {
  const noodle = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });
  await logFeeding({ petId: noodle.id, at: new Date(2026, 10, 3, 18, 0).toISOString(), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate' });
  return JSON.stringify(await createBackup(new Date(2026, 10, 8, 9, 0)));
}

const pick = (text: string, name = 'reptender-backup-2026-11-08.json') =>
  fireEvent.change(screen.getByLabelText('Import backup'), {
    target: { files: [new File([text], name, { type: 'application/json' })] },
  });

describe('Export backup', () => {
  it('starts at "Never backed up" in amber, then saves a file and records the date', async () => {
    await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });
    const { share, file } = mockShare();
    renderSettings();
    const data = await card();
    expect(within(data).getByText('Never backed up')).toHaveClass('warn');

    await userEvent.click(within(data).getByRole('button', { name: 'Export backup' }));
    await userEvent.click(await within(data).findByRole('button', { name: /^Save backup file \(\d+ KB\)$/ }));
    await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(file().name).toMatch(/^reptender-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(await file().text())).toMatchObject({ app: 'RepTender', schemaVersion: 2 });

    expect(await within(data).findByRole('status')).toHaveTextContent('Backup saved.');
    expect(await within(data).findByText('Last backup today')).not.toHaveClass('warn');
    expect((await getSettings()).lastBackupAt).toBeDefined();
  });

  it('keeps the file ready when the share sheet is cancelled', async () => {
    const { share } = mockShare();
    share.mockRejectedValueOnce(new DOMException('Share canceled', 'AbortError'));
    renderSettings();
    const data = await card();
    await userEvent.click(within(data).getByRole('button', { name: 'Export backup' }));
    const save = await within(data).findByRole('button', { name: /^Save backup file/ });
    await userEvent.click(save);
    await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(save).toBeEnabled()); // the rejection has been processed
    expect(within(data).queryByRole('status')).toBeNull();
    expect((await getSettings()).lastBackupAt).toBeUndefined();
  });

  it('downloads when the file cannot be shared', async () => {
    mockShare(false);
    const urls = stubObjectUrls();
    renderSettings();
    const data = await card();
    await userEvent.click(within(data).getByRole('button', { name: 'Export backup' }));
    await userEvent.click(await within(data).findByRole('button', { name: /^Save backup file/ }));
    expect(await within(data).findByRole('status')).toHaveTextContent(/^Downloaded reptender-backup-\d{4}-\d{2}-\d{2}\.json\.$/);
    expect(urls.click).toHaveBeenCalledTimes(1);
  });

  it('shows the last backup in amber after 30 days', async () => {
    await updateSettings({ lastBackupAt: subDays(new Date(), 31).toISOString() });
    renderSettings();
    expect(await within(await card()).findByText('Last backup 31 days ago')).toHaveClass('warn');
  });
});

describe('Import backup', () => {
  it('shows a summary, then replaces all data', async () => {
    const text = await backupText();
    await resetDb();
    await createPet({ name: 'Intruder', species: 'Gecko', feedingIntervalDays: 3 });
    renderSettings();
    await card();
    pick(text);

    const sheet = await screen.findByRole('dialog', { name: 'Import backup' });
    expect(sheet).toHaveTextContent('This backup has 1 pet, 1 entry, 0 photos, exported Nov 8, 2026.');
    expect(sheet).toHaveTextContent('Importing replaces all data on this iPhone.');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Replace all data' }));

    expect(await within(await card()).findByRole('status')).toHaveTextContent('Backup imported: 1 pet, 1 entry, 0 photos.');
    expect(screen.queryByRole('dialog', { name: 'Import backup' })).toBeNull();
    expect((await db.pets.toArray()).map((p) => p.name)).toEqual(['Noodle']);
    expect(await db.feedings.count()).toBe(1);
  });

  it('cancel keeps the current data', async () => {
    const text = await backupText();
    await resetDb();
    await createPet({ name: 'Keeper', species: 'Gecko', feedingIntervalDays: 3 });
    renderSettings();
    await card();
    pick(text);
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Import backup' })).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Import backup' })).toBeNull();
    expect((await db.pets.toArray()).map((p) => p.name)).toEqual(['Keeper']);
  });

  it('rejects an invalid file with a clear message and changes nothing', async () => {
    await createPet({ name: 'Keeper', species: 'Gecko', feedingIntervalDays: 3 });
    renderSettings();
    await card();
    pick('{"app":"SnakeKeeper"}', 'other.json');
    expect(await screen.findByRole('alert')).toHaveTextContent("That file isn't a RepTender backup.");
    expect(screen.queryByRole('dialog', { name: 'Import backup' })).toBeNull();
    expect((await db.pets.toArray()).map((p) => p.name)).toEqual(['Keeper']);
  });
});

describe('Storage warning', () => {
  it('appears above 80% used', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: { estimate: async () => ({ usage: 900, quota: 1000 }) }, configurable: true,
    });
    renderSettings();
    expect(await within(await card()).findByText('Storage is 90% full. Export a backup so nothing is lost.')).toHaveClass('warn');
  });

  it('stays hidden below that', async () => {
    let resolve!: (e: StorageEstimate) => void;
    const estimate = vi.fn(() => new Promise<StorageEstimate>((r) => (resolve = r)));
    Object.defineProperty(navigator, 'storage', { value: { estimate }, configurable: true });
    renderSettings();
    const data = await card();
    await vi.waitFor(() => expect(estimate).toHaveBeenCalled());
    // Settle the estimate inside act and let the hook's promise chain finish, so no update lands after the test.
    await act(async () => {
      resolve({ usage: 100, quota: 1000 });
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(within(data).queryByText(/^Storage is/)).toBeNull();
  });
});
