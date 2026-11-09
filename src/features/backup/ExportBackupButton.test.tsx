import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportBackupButton } from './ExportBackupButton';
import { resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { savePhoto } from '../../db/photos';
import { getSettings } from '../../db/settings';
import { parseBackup } from '../../db/backup';
import { mockShare, unmockShare } from '../../test/share';

beforeEach(async () => {
  vi.stubGlobal('Blob', NodeBlob); // fake-indexeddb only keeps real Blobs
  await resetDb();
});

afterEach(() => {
  unmockShare();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const jpeg = (bytes: number[]) => new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });

/** Reads of a stored blob with exactly this many bytes fail, like a Blob WebKit lost. */
function breakBlobsOfSize(size: number) {
  const read = NodeBlob.prototype.arrayBuffer;
  vi.spyOn(NodeBlob.prototype, 'arrayBuffer').mockImplementation(function (this: Blob) {
    return this.size === size ? Promise.reject(new DOMException('gone', 'NotReadableError')) : read.call(this);
  });
}

async function seedPhotos(count: number) {
  for (let i = 0; i < count; i++) {
    const photoId = await savePhoto({ blob: jpeg([1, 2, 3, 4, 5]), thumbBlob: jpeg([9, 9]), width: 4, height: 3 });
    await createPet({ name: `Pet ${i + 1}`, species: 'Corn Snake', feedingIntervalDays: 5, photoId });
  }
}

it('says nothing about photos when all of them could be read', async () => {
  await seedPhotos(1);
  mockShare();
  render(<ExportBackupButton />);
  await userEvent.click(screen.getByRole('button', { name: 'Export backup' }));
  expect(await screen.findByRole('button', { name: /^Save backup file/ })).toBeEnabled();
  expect(screen.queryByText(/couldn't be read/)).toBeNull();
});

it('still makes the backup when a photo cannot be read, and tells the user', async () => {
  await seedPhotos(1);
  breakBlobsOfSize(5);
  const { share, file } = mockShare();
  render(<ExportBackupButton />);
  await userEvent.click(screen.getByRole('button', { name: 'Export backup' }));
  const save = await screen.findByRole('button', { name: /^Save backup file/ });
  expect(screen.getByRole('alert')).toHaveTextContent("1 photo couldn't be read and was left out. Everything else is in the backup.");

  await userEvent.click(save);
  await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  const parsed = parseBackup(await file().text());
  expect(parsed.tables.pets.map((p) => p.name)).toEqual(['Pet 1']);
  expect(parsed.tables.pets[0]!.photoId).toBeUndefined();
  expect(parsed.tables.photos).toEqual([]);
  expect(await screen.findByRole('status')).toHaveTextContent('Backup saved.');
  expect((await getSettings()).lastBackupAt).toBeDefined();
  expect(screen.getByRole('alert')).toHaveTextContent("1 photo couldn't be read"); // still visible after saving
});

it('uses the plural when several photos cannot be read', async () => {
  await seedPhotos(2);
  breakBlobsOfSize(5);
  mockShare();
  render(<ExportBackupButton />);
  await userEvent.click(screen.getByRole('button', { name: 'Export backup' }));
  await screen.findByRole('button', { name: /^Save backup file/ });
  expect(screen.getByRole('alert')).toHaveTextContent("2 photos couldn't be read and were left out.");
});
