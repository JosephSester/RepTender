import { beforeEach, expect, it } from 'vitest';
import { db, resetDb } from './db';
import { createPet } from './pets';
import { savePhoto } from './photos';
import { createVetVisit, deleteVetVisit, listVetVisits, updateVetVisit } from './vetVisits';
import { ValidationError } from './ids';

let petId: string;
const photo = () => savePhoto({ blob: new Blob(['full']), thumbBlob: new Blob(['thumb']), width: 4, height: 3 });

beforeEach(async () => {
  await resetDb();
  petId = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
});

it('creates visits with trimmed text and no photos by default, oldest first', async () => {
  await createVetVisit({ petId, date: '2026-06-14', clinic: ' Exotic Animal Clinic ', reason: 'Wellness exam', cost: 85 });
  const first = await createVetVisit({ petId, date: '2026-04-20', vet: '', notes: 'No mites' });
  expect(first.photoIds).toEqual([]);
  expect(first.vet).toBeUndefined();
  const visits = await listVetVisits(petId);
  expect(visits.map((v) => v.date)).toEqual(['2026-04-20', '2026-06-14']);
  expect(visits[1]).toMatchObject({ clinic: 'Exotic Animal Clinic', reason: 'Wellness exam', cost: 85 });
});

it('validates the date, the cost and the next appointment', async () => {
  await expect(createVetVisit({ petId, date: '' })).rejects.toBeInstanceOf(ValidationError);
  await expect(createVetVisit({ petId, date: '2026-06-14', cost: -1 })).rejects.toThrow('Cost must be a number');
  await expect(createVetVisit({ petId, date: '2026-06-14', nextAppointment: 'soon' })).rejects.toBeInstanceOf(ValidationError);
  await expect(createVetVisit({ petId: 'missing', date: '2026-06-14' })).rejects.toThrow('not found');
});

it('updating deletes the photos taken off the visit and clears emptied fields', async () => {
  const keep = await photo();
  const drop = await photo();
  const v = await createVetVisit({
    petId, date: '2026-06-14', reason: 'Wellness exam', cost: 85, photoIds: [keep, drop],
    nextAppointment: new Date(2027, 5, 14, 10, 0).toISOString(),
  });
  await updateVetVisit(v.id, { reason: '', cost: undefined, photoIds: [keep], nextAppointment: undefined });
  const after = (await db.vetVisits.get(v.id))!;
  expect(after.photoIds).toEqual([keep]);
  expect(after.reason).toBeUndefined();
  expect(after.cost).toBeUndefined();
  expect(after.nextAppointment).toBeUndefined();
  expect((await db.photos.toArray()).map((p) => p.id)).toEqual([keep]);
  await expect(updateVetVisit('missing', { reason: 'x' })).rejects.toThrow('not found');
});

it('deleting a visit deletes its photos', async () => {
  const v = await createVetVisit({ petId, date: '2026-06-14', photoIds: [await photo()] });
  await deleteVetVisit(v.id);
  expect(await listVetVisits(petId)).toEqual([]);
  expect(await db.photos.count()).toBe(0);
});
