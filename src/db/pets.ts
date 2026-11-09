import type { Pet } from '../domain/types';
import { DEFAULT_FEED_TIME } from '../domain/dates';
import { db } from './db';
import { newId, nowIso, ValidationError } from './ids';

type Required3 = 'name' | 'species' | 'feedingIntervalDays';
export type PetInput = Pick<Pet, Required3> &
  Partial<Omit<Pet, 'id' | 'createdAt' | 'updatedAt' | Required3>>;

function validate(p: Partial<PetInput>): void {
  if (p.name !== undefined && !p.name.trim()) throw new ValidationError('Name is required');
  if (p.species !== undefined && !p.species.trim()) throw new ValidationError('Species is required');
  if (p.feedingIntervalDays !== undefined && !(Number.isInteger(p.feedingIntervalDays) && p.feedingIntervalDays >= 1)) {
    throw new ValidationError('Feed every must be at least 1 day');
  }
  if (p.usualQuantity !== undefined && !(Number.isInteger(p.usualQuantity) && p.usualQuantity >= 1)) {
    throw new ValidationError('Usual quantity must be at least 1');
  }
}

export async function createPet(input: PetInput): Promise<Pet> {
  validate(input);
  const ts = nowIso();
  const pet: Pet = {
    sex: 'unknown',
    origin: 'unknown',
    birthDateApprox: false,
    usualQuantity: 1,
    usualFeedTime: DEFAULT_FEED_TIME,
    habitatTargets: {},
    ...input,
    name: input.name.trim(),
    species: input.species.trim(),
    id: newId(),
    createdAt: ts,
    updatedAt: ts,
  };
  await db.pets.add(pet);
  return pet;
}

/** Fields set to `undefined` in `patch` are removed from the record. */
export async function updatePet(id: string, patch: Partial<PetInput>): Promise<void> {
  validate(patch);
  const changed = await db.pets.update(id, { ...patch, updatedAt: nowIso() });
  if (!changed) throw new Error(`Pet ${id} not found`);
}

export const getPet = (id: string) => db.pets.get(id);

const byName = (a: Pet, b: Pet) => a.name.localeCompare(b.name);

export async function listActivePets(): Promise<Pet[]> {
  const all = await db.pets.toArray();
  return all.filter((p) => !p.archivedAt).sort(byName);
}

export async function listArchivedPets(): Promise<Pet[]> {
  const all = await db.pets.toArray();
  return all.filter((p) => p.archivedAt).sort(byName);
}

export async function archivePet(id: string): Promise<void> {
  const ts = nowIso();
  await db.pets.update(id, { archivedAt: ts, updatedAt: ts });
}

export async function unarchivePet(id: string): Promise<void> {
  const changed = await db.pets.update(id, { archivedAt: undefined, updatedAt: nowIso() });
  if (!changed) throw new Error(`Pet ${id} not found`);
}

/** Deletes the pet and everything that belongs to it, including photos. "All pets" care tasks stay. */
export async function deletePet(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.pets, db.feedings, db.regurgitations, db.photos, db.sheds, db.poops, db.measurements,
      db.habitatReadings, db.careTasks, db.careCompletions, db.vetVisits, db.notes,
    ],
    async () => {
      const pet = await db.pets.get(id);
      const visits = await db.vetVisits.where('petId').equals(id).toArray();
      const taskIds = await db.careTasks.where('petId').equals(id).primaryKeys();
      await db.feedings.where('petId').equals(id).delete();
      await db.regurgitations.where('petId').equals(id).delete();
      await db.sheds.where('petId').equals(id).delete();
      await db.poops.where('petId').equals(id).delete();
      await db.measurements.where('petId').equals(id).delete();
      await db.habitatReadings.where('petId').equals(id).delete();
      await db.notes.where('petId').equals(id).delete();
      await db.vetVisits.where('petId').equals(id).delete();
      if (taskIds.length > 0) await db.careCompletions.where('taskId').anyOf(taskIds).delete();
      await db.careTasks.bulkDelete(taskIds);
      const photoIds = [pet?.photoId, ...visits.flatMap((v) => v.photoIds)].filter((p): p is string => !!p);
      await db.photos.bulkDelete(photoIds);
      await db.pets.delete(id);
    },
  );
}
