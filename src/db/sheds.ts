import Dexie from 'dexie';
import type { Shed, ShedQuality } from '../domain/types';
import { SHED_QUALITIES } from '../domain/sheds';
import { db } from './db';
import { cleanText, newId, nowIso, requireDateKey, ValidationError } from './ids';

export interface ShedInput {
  petId: string;
  date: string;
  quality: ShedQuality;
  inBlueDate?: string;
  notes?: string;
}

export async function logShed(input: ShedInput): Promise<Shed> {
  requireDateKey(input.date, 'Pick the shed date');
  const inBlueDate = cleanText(input.inBlueDate);
  if (inBlueDate !== undefined) {
    requireDateKey(inBlueDate, 'Pick the “in blue” date');
    if (inBlueDate > input.date) throw new ValidationError('“In blue” must be on or before the shed date');
  }
  if (!SHED_QUALITIES.some((q) => q.value === input.quality)) throw new ValidationError('Pick how the shed went');
  return db.transaction('rw', [db.pets, db.sheds], async () => {
    const pet = await db.pets.get(input.petId);
    if (!pet) throw new Error(`Pet ${input.petId} not found`);
    const ts = nowIso();
    const shed: Shed = {
      id: newId(), petId: pet.id, date: input.date, inBlueDate, quality: input.quality,
      notes: cleanText(input.notes), createdAt: ts, updatedAt: ts,
    };
    await db.sheds.add(shed);
    // The shed the pet was "in blue" for has happened. A backfilled older shed leaves the mark alone.
    if (pet.inBlueSince && input.date >= pet.inBlueSince) {
      await db.pets.update(pet.id, { inBlueSince: undefined, updatedAt: ts });
    }
    return shed;
  });
}

/** Spec §5.7 Mark "in blue": remembered on the pet until the next shed is logged. */
export async function markInBlue(petId: string, date: string): Promise<void> {
  requireDateKey(date);
  const changed = await db.pets.update(petId, { inBlueSince: date, updatedAt: nowIso() });
  if (!changed) throw new Error(`Pet ${petId} not found`);
}

export async function clearInBlue(petId: string): Promise<void> {
  const changed = await db.pets.update(petId, { inBlueSince: undefined, updatedAt: nowIso() });
  if (!changed) throw new Error(`Pet ${petId} not found`);
}

export async function deleteShed(id: string): Promise<void> {
  await db.sheds.delete(id);
}

export const listSheds = (petId: string): Promise<Shed[]> =>
  db.sheds.where('[petId+date]').between([petId, Dexie.minKey], [petId, Dexie.maxKey]).toArray();
