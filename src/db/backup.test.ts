import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { db, resetDb, SCHEMA_VERSION } from './db';
import { createPet, getPet } from './pets';
import { savePhoto, getPhoto } from './photos';
import { logFeeding } from './feedings';
import { logShed } from './sheds';
import { logMeasurement } from './measurements';
import { completeCareTask, createCareTask } from './care';
import { createVetVisit } from './vetVisits';
import { getSettings } from './settings';
import {
  backupFileName, createBackup, createBackupFile, markBackedUp, parseBackup, readAllTables, restoreBackup,
  summarizeBackup, summaryText, type BackupJson,
} from './backup';
import { BackupError, TABLE_NAMES } from './backupSchema';
import { loadSampleData } from '../dev/sampleData';

const now = new Date(2026, 10, 8, 9, 0);
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3];

beforeEach(async () => {
  vi.stubGlobal('Blob', NodeBlob); // fake-indexeddb only keeps real Blobs
  await resetDb();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const photo = (bytes = JPEG) =>
  savePhoto({ blob: new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }), thumbBlob: new Blob([new Uint8Array([9, 9])], { type: 'image/jpeg' }), width: 4, height: 3 });

/** One record in most tables, two photos. */
async function seed() {
  const photoId = await photo();
  const noodle = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5, photoId });
  const meal = await logFeeding({ petId: noodle.id, at: new Date(2026, 10, 3, 18, 0).toISOString(), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate' });
  await logShed({ petId: noodle.id, date: '2026-11-01', quality: 'complete' });
  await logMeasurement({ petId: noodle.id, date: '2026-11-01', weightG: 42 });
  const task = await createCareTask({ petId: noodle.id, name: 'Mist', intervalDays: 2 });
  await completeCareTask(task.id, new Date(2026, 10, 7, 9, 0).toISOString());
  await createVetVisit({ petId: noodle.id, date: '2026-06-14', photoIds: [await photo([1, 2, 3])] });
  return { noodle, meal, photoId };
}

const clone = (b: BackupJson): BackupJson => JSON.parse(JSON.stringify(b));

describe('export (spec §9)', () => {
  it('writes every table, with photos as base64 data URLs', async () => {
    const { photoId } = await seed();
    const backup = await createBackup(now);
    expect(backup).toMatchObject({ app: 'RepTender', schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString() });
    expect(Object.keys(backup.tables).sort()).toEqual([...TABLE_NAMES].sort());
    const stored = backup.tables.photos.find((p) => p.id === photoId)!;
    expect(stored.blob).toBe('data:image/jpeg;base64,/9j/4AECAw==');
    expect(stored).toMatchObject({ width: 4, height: 3 });
    expect(backup.tables.feedings).toHaveLength(1);
    expect(backup.tables.settings).toEqual([expect.objectContaining({ id: 'settings', theme: 'auto' })]);
    expect(backupFileName(now)).toBe('reptender-backup-2026-11-08.json');
  });

  it('makes a JSON file and records the backup date', async () => {
    await seed();
    const file = await createBackupFile(now);
    expect(file.name).toBe('reptender-backup-2026-11-08.json');
    expect(file.type).toBe('application/json');
    expect(JSON.parse(await file.text())).toMatchObject({ app: 'RepTender', schemaVersion: SCHEMA_VERSION });
    expect((await getSettings()).lastBackupAt).toBeUndefined(); // only after the file was handed over
    await markBackedUp(now);
    expect((await getSettings()).lastBackupAt).toBe(now.toISOString());
  });

  it('leaves out orphan rows and dangling links, so its own import never fails', async () => {
    const { noodle } = await seed();
    const ts = now.toISOString();
    await db.feedings.add({ id: 'orphan', petId: 'gone', at: ts, foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate', createdAt: ts, updatedAt: ts });
    await db.careCompletions.add({ id: 'orphan-done', taskId: 'gone', at: ts, createdAt: ts, updatedAt: ts });
    await db.pets.update(noodle.id, { photoId: 'missing-photo', sire: { name: 'Apollo', petId: 'deleted-pet' } });
    const backup = await createBackup(now);
    expect(backup.tables.feedings.map((f) => f.id)).not.toContain('orphan');
    expect(backup.tables.careCompletions.map((c) => c.id)).not.toContain('orphan-done');
    const pet = backup.tables.pets.find((p) => p.id === noodle.id)!;
    expect(pet.photoId).toBeUndefined();
    expect(pet.sire).toEqual({ name: 'Apollo' });
    expect(() => parseBackup(JSON.stringify(backup))).not.toThrow();
  });
});

describe('import (spec §9)', () => {
  it('round-trips the whole database, photos included, replacing what was there', async () => {
    await loadSampleData(now);
    const { photoId } = await seed();
    const before = await readAllTables();
    const text = JSON.stringify(await createBackup(now));

    await resetDb();
    await createPet({ name: 'Intruder', species: 'Gecko', feedingIntervalDays: 3 });
    const parsed = parseBackup(text);
    const summary = summarizeBackup(parsed);
    expect(summary).toEqual({
      pets: 5,
      photos: 2,
      entries: before.feedings.length + before.regurgitations.length + before.sheds.length + before.poops.length +
        before.measurements.length + before.habitatReadings.length + before.careCompletions.length +
        before.vetVisits.length + before.notes.length,
    });
    await restoreBackup(parsed);

    const after = await readAllTables();
    for (const name of TABLE_NAMES) {
      if (name === 'photos' || name === 'settings') continue;
      expect(after[name], name).toEqual(before[name]);
    }
    expect((await db.pets.toArray()).map((p) => p.name)).not.toContain('Intruder');
    const restored = (await getPhoto(photoId))!;
    expect(restored).toMatchObject({ width: 4, height: 3 });
    expect(restored.blob.type).toBe('image/jpeg');
    expect([...new Uint8Array(await restored.blob.arrayBuffer())]).toEqual(JPEG);
    expect((await getSettings()).lastBackupAt).toBe(now.toISOString());
  }, 20000);

  it('migrates a schema 1 backup (Plan 1 tables only)', async () => {
    const ts = '2026-11-01T12:00:00.000Z';
    const v1 = {
      app: 'RepTender', schemaVersion: 1, exportedAt: ts,
      tables: {
        pets: [{
          id: 'p1', name: 'Noodle', species: 'Corn Snake', sex: 'female', origin: 'captive_bred', birthDateApprox: false,
          feedingIntervalDays: 5, usualQuantity: 1, usualFeedTime: '18:00', createdAt: ts, updatedAt: ts,
        }],
        feedings: [{ id: 'f1', petId: 'p1', at: ts, foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate', createdAt: ts, updatedAt: ts }],
        regurgitations: [{ id: 'r1', petId: 'p1', feedingId: 'f1', at: ts, pushBackDays: 10, notes: null, createdAt: ts, updatedAt: ts }],
        photos: [],
        foodItems: [{ id: 'fi1', name: 'Pinky mouse', isCustom: false, createdAt: ts, updatedAt: ts }],
        settings: [{ id: 'settings', theme: 'dark', tempUnit: 'C', weightUnit: 'g', lengthUnit: 'cm' }],
      },
    };
    const parsed = parseBackup(JSON.stringify(v1));
    expect(summaryText(summarizeBackup(parsed))).toBe('1 pet, 2 entries, 0 photos');
    await restoreBackup(parsed);
    expect(await getPet('p1')).toMatchObject({ name: 'Noodle', habitatTargets: {} });
    expect((await db.regurgitations.get('r1'))!.notes).toBeUndefined();
    expect(await db.sheds.count()).toBe(0);
    expect(await getSettings()).toMatchObject({ theme: 'dark', tempUnit: 'C', lastBackupAt: ts });
  });

  it('words the summary', () => {
    expect(summaryText({ pets: 4, entries: 120, photos: 6 })).toBe('4 pets, 120 entries, 6 photos');
    expect(summaryText({ pets: 1, entries: 1, photos: 1 })).toBe('1 pet, 1 entry, 1 photo');
  });

  it('keeps the current data when writing the backup fails part-way', async () => {
    await seed();
    const parsed = parseBackup(JSON.stringify(await createBackup(now)));
    await resetDb();
    await createPet({ name: 'Keeper', species: 'Gecko', feedingIntervalDays: 3 });
    // Slip a duplicate key past validation: bulkAdd fails after pets and feedings were already written.
    parsed.tables.vetVisits.push({ ...parsed.tables.vetVisits[0]! });
    await expect(restoreBackup(parsed)).rejects.toThrow();
    expect((await db.pets.toArray()).map((p) => p.name)).toEqual(['Keeper']);
    expect(await db.feedings.count()).toBe(0);
  });
});

describe('invalid backups are rejected with a clear message (spec §9)', () => {
  let good: BackupJson;
  beforeEach(async () => {
    await seed();
    good = await createBackup(now);
  });

  const cases: [string, (b: BackupJson) => unknown, string][] = [
    ['another app', (b) => ({ ...b, app: 'SnakeKeeper' }), "isn't a RepTender backup"],
    ['a newer schema', (b) => ({ ...b, schemaVersion: SCHEMA_VERSION + 1 }), 'newer version of RepTender'],
    ['an unknown schema', (b) => ({ ...b, schemaVersion: 0 }), 'unknown schema version'],
    ['a bad export date', (b) => ({ ...b, exportedAt: 'soon' }), 'no valid export date'],
    ['a missing table', (b) => ({ ...b, tables: { ...b.tables, feedings: undefined } }), 'missing the feedings table'],
    ['a wrong type', (b) => { (b.tables.feedings[0] as unknown as Record<string, unknown>).quantity = '2'; return b; }, 'Row 1 of feedings: "quantity" is missing or not valid.'],
    ['a bad date-time', (b) => { b.tables.feedings[0]!.at = 'yesterday'; return b; }, 'Row 1 of feedings: "at" is missing or not valid.'],
    ['a bad day', (b) => { b.tables.sheds[0]!.date = '2026-02-30'; return b; }, 'Row 1 of sheds: "date" is missing or not valid.'],
    ['an unknown outcome', (b) => { (b.tables.feedings[0] as unknown as Record<string, unknown>).outcome = 'maybe'; return b; }, '"outcome" is missing or not valid.'],
    ['a dangling reference', (b) => { b.tables.feedings[0]!.petId = 'nope'; return b; }, 'Row 1 of feedings: "petId" points to a record that isn\'t in the backup.'],
    ['a dangling photo', (b) => { b.tables.vetVisits[0]!.photoIds = ['nope']; return b; }, 'Row 1 of vetVisits: "photoIds" points to a record'],
    ['bad photo data', (b) => { b.tables.photos[0]!.blob = 'data:image/jpeg;base64,@@@'; return b; }, '"blob" is missing or not valid.'],
    ['a duplicate id', (b) => { b.tables.pets.push({ ...b.tables.pets[0]! }); return b; }, 'Row 2 of pets: "id" is used twice.'],
    ['an empty measurement', (b) => { delete b.tables.measurements[0]!.weightG; return b; }, 'Row 1 of measurements needs at least one of weightG, lengthMm.'],
    ['not a list', (b) => ({ ...b, tables: { ...b.tables, notes: {} } }), 'missing the notes table'],
  ];

  it.each(cases)('rejects %s', async (_name, mutate, message) => {
    const text = JSON.stringify(mutate(clone(good)));
    expect(() => parseBackup(text)).toThrow(BackupError);
    expect(() => parseBackup(text)).toThrow(message);
    expect(await db.pets.count()).toBe(1); // nothing was touched
  });

  it('rejects files that are not JSON or not an object', () => {
    expect(() => parseBackup('{oops')).toThrow("That file isn't a RepTender backup (it isn't valid JSON).");
    expect(() => parseBackup('[1, 2]')).toThrow("That file isn't a RepTender backup.");
    expect(() => parseBackup('null')).toThrow("That file isn't a RepTender backup.");
  });
});
