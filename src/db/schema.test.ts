import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, RepTenderDB, resetDb, SCHEMA_VERSION } from './db';
import { createPet, deletePet } from './pets';
import { savePhoto } from './photos';
import { newId, nowIso } from './ids';

const UPGRADE_DB = 'reptender-upgrade-test';

// Exactly the Plan 1 (version 1) schema.
const V1_STORES = {
  pets: 'id, name, archivedAt',
  feedings: 'id, petId, [petId+at]',
  regurgitations: 'id, petId, feedingId, [petId+at]',
  photos: 'id',
  foodItems: 'id, &name',
  settings: 'id',
};

describe('schema version 2', () => {
  afterEach(async () => {
    await Dexie.delete(UPGRADE_DB);
  });

  it('upgrades a version 1 database with every record intact', async () => {
    const ts = '2026-11-01T12:00:00.000Z';
    const v1 = new Dexie(UPGRADE_DB);
    v1.version(1).stores(V1_STORES);
    // A record shaped like an early Plan 1 pet that never got habitatTargets.
    await v1.table('pets').add({
      id: 'p1', name: 'Noodle', species: 'Corn Snake', sex: 'female', origin: 'captive_bred', birthDateApprox: false,
      feedingIntervalDays: 5, usualQuantity: 1, usualFeedTime: '18:00', nextFeedingOverride: ts, createdAt: ts, updatedAt: ts,
    });
    await v1.table('pets').add({
      id: 'p2', name: 'Ziggy', species: 'Leopard Gecko', sex: 'male', origin: 'unknown', birthDateApprox: false,
      feedingIntervalDays: 3, usualQuantity: 8, habitatTargets: { warmMinC: 30 }, archivedAt: ts, createdAt: ts, updatedAt: ts,
    });
    await v1.table('feedings').add({ id: 'f1', petId: 'p1', at: ts, foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate', createdAt: ts, updatedAt: ts });
    await v1.table('regurgitations').add({ id: 'r1', petId: 'p1', feedingId: 'f1', at: ts, pushBackDays: 10, createdAt: ts, updatedAt: ts });
    await v1.table('photos').add({ id: 'ph1', blob: 'jpeg', thumbBlob: 'thumb', width: 4, height: 3, createdAt: ts, updatedAt: ts });
    await v1.table('foodItems').add({ id: 'fi1', name: 'Pinky mouse', isCustom: false, createdAt: ts, updatedAt: ts });
    await v1.table('settings').add({ id: 'settings', theme: 'dark', tempUnit: 'C', weightUnit: 'g', lengthUnit: 'cm' });
    v1.close();

    const v2 = new RepTenderDB(UPGRADE_DB);
    await v2.open();
    expect(v2.verno).toBe(SCHEMA_VERSION);
    expect(await v2.pets.get('p1')).toMatchObject({ name: 'Noodle', nextFeedingOverride: ts, habitatTargets: {} });
    expect(await v2.pets.get('p2')).toMatchObject({ archivedAt: ts, habitatTargets: { warmMinC: 30 } });
    expect(await v2.feedings.get('f1')).toMatchObject({ petId: 'p1', outcome: 'ate' });
    expect(await v2.regurgitations.get('r1')).toMatchObject({ feedingId: 'f1', pushBackDays: 10 });
    expect(await v2.photos.get('ph1')).toMatchObject({ width: 4, height: 3 });
    expect(await v2.foodItems.count()).toBe(1); // the seed only runs for a brand-new database
    expect(await v2.settings.get('settings')).toMatchObject({ theme: 'dark', tempUnit: 'C', lengthUnit: 'cm' });

    await v2.sheds.add({ id: 's1', petId: 'p1', date: '2026-11-02', quality: 'complete', createdAt: ts, updatedAt: ts });
    expect(await v2.sheds.where('[petId+date]').between(['p1', Dexie.minKey], ['p1', Dexie.maxKey]).count()).toBe(1);
    v2.close();
  });

  it('a brand-new database has the husbandry tables and the seed', async () => {
    await resetDb();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      'careCompletions', 'careTasks', 'feedings', 'foodItems', 'habitatReadings', 'measurements',
      'notes', 'pets', 'photos', 'poops', 'regurgitations', 'settings', 'sheds', 'vetVisits',
    ]);
    expect(await db.foodItems.count()).toBe(11);
  });
});

describe('deletePet', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('deletes every record and photo of that pet, and nothing of other pets', async () => {
    const ts = nowIso();
    const row = (petId: string) => ({ id: newId(), petId, createdAt: ts, updatedAt: ts });
    const photo = () => savePhoto({ blob: new Blob(['full']), thumbBlob: new Blob(['thumb']), width: 1, height: 1 });

    const noodle = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5, photoId: await photo() });
    const ziggy = await createPet({ name: 'Ziggy', species: 'Leopard Gecko', feedingIntervalDays: 3 });
    for (const petId of [noodle.id, ziggy.id]) {
      await db.sheds.add({ ...row(petId), date: '2026-11-01', quality: 'complete' });
      await db.poops.add({ ...row(petId), at: ts, kind: 'normal' });
      await db.measurements.add({ ...row(petId), date: '2026-11-01', weightG: 40 });
      await db.habitatReadings.add({ ...row(petId), at: ts, warmC: 31 });
      await db.notes.add({ ...row(petId), at: ts, text: 'Shed soon' });
      await db.vetVisits.add({ ...row(petId), date: '2026-06-14', photoIds: [await photo()] });
    }
    const ownTask = { id: newId(), petId: noodle.id, name: 'Deep clean', intervalDays: 30, createdAt: ts, updatedAt: ts };
    const allPetsTask = { id: newId(), name: 'Fresh water', intervalDays: 2, createdAt: ts, updatedAt: ts };
    await db.careTasks.bulkAdd([ownTask, allPetsTask]);
    await db.careCompletions.bulkAdd([
      { id: newId(), taskId: ownTask.id, at: ts, createdAt: ts, updatedAt: ts },
      { id: newId(), taskId: allPetsTask.id, at: ts, createdAt: ts, updatedAt: ts },
    ]);
    expect(await db.photos.count()).toBe(3);

    await deletePet(noodle.id);

    const petIds = async (rows: Promise<{ petId: string }[]>) => (await rows).map((r) => r.petId);
    expect(await petIds(db.sheds.toArray())).toEqual([ziggy.id]);
    expect(await petIds(db.poops.toArray())).toEqual([ziggy.id]);
    expect(await petIds(db.measurements.toArray())).toEqual([ziggy.id]);
    expect(await petIds(db.habitatReadings.toArray())).toEqual([ziggy.id]);
    expect(await petIds(db.notes.toArray())).toEqual([ziggy.id]);
    expect(await petIds(db.vetVisits.toArray())).toEqual([ziggy.id]);
    expect((await db.careTasks.toArray()).map((t) => t.name)).toEqual(['Fresh water']);
    expect((await db.careCompletions.toArray()).map((c) => c.taskId)).toEqual([allPetsTask.id]);
    const ziggyVisit = (await db.vetVisits.toArray())[0]!;
    expect((await db.photos.toArray()).map((p) => p.id)).toEqual(ziggyVisit.photoIds);
  });
});
