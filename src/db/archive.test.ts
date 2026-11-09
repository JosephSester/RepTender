import { beforeEach, expect, it } from 'vitest';
import { resetDb } from './db';
import { archivePet, createPet, getPet, listActivePets, listArchivedPets, unarchivePet } from './pets';

beforeEach(async () => {
  await resetDb();
});

it('lists archived pets A–Z and unarchives one', async () => {
  const pebble = await createPet({ name: 'Pebble', species: 'Russian Tortoise', feedingIntervalDays: 2 });
  const basil = await createPet({ name: 'Basil', species: 'Bearded Dragon', feedingIntervalDays: 2 });
  await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });
  await archivePet(pebble.id);
  await archivePet(basil.id);
  expect((await listArchivedPets()).map((p) => p.name)).toEqual(['Basil', 'Pebble']);

  await unarchivePet(pebble.id);
  expect((await getPet(pebble.id))!.archivedAt).toBeUndefined();
  expect((await listArchivedPets()).map((p) => p.name)).toEqual(['Basil']);
  expect((await listActivePets()).map((p) => p.name)).toEqual(['Noodle', 'Pebble']);
});

it('unarchiving a missing pet fails', async () => {
  await expect(unarchivePet('missing')).rejects.toThrow('not found');
});
