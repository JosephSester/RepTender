import Dexie from 'dexie';
import { parseISO } from 'date-fns';
import type { Feeding, FeedingOutcome, Pet, Regurgitation } from '../domain/types';
import { isValidPushBackDays, MAX_PUSH_BACK_DAYS, pushBackOverride } from '../domain/feeding';
import { db } from './db';
import { newId, nowIso, ValidationError } from './ids';

export interface LogFeedingInput {
  petId: string;
  at: string;
  foodItem: string;
  quantity: number;
  outcome: FeedingOutcome;
  notes?: string;
  /** Set when the Log a Feeding sheet's "Regurgitated" button was chosen (spec §5.3). */
  regurgitated?: { foundAt: string; pushBackDays: number | null; notes?: string };
}

export interface LogRegurgitationInput {
  petId: string;
  feedingId: string;
  at: string;
  pushBackDays: number | null;
  notes?: string;
}

const clean = (s?: string) => s?.trim() || undefined;

function validateQuantity(q: number): void {
  if (!Number.isInteger(q) || q < 1) throw new ValidationError('Quantity must be at least 1');
}

async function addRegurgitation(
  pet: Pet,
  r: { feedingId: string; at: string; pushBackDays: number | null; notes?: string },
): Promise<Regurgitation> {
  if (r.pushBackDays !== null && !isValidPushBackDays(r.pushBackDays)) {
    throw new ValidationError(`Push back must be 1 to ${MAX_PUSH_BACK_DAYS} days`);
  }
  const ts = nowIso();
  const rec: Regurgitation = {
    id: newId(), petId: pet.id, feedingId: r.feedingId, at: r.at,
    pushBackDays: r.pushBackDays ?? undefined, notes: clean(r.notes), createdAt: ts, updatedAt: ts,
  };
  await db.regurgitations.add(rec);
  if (r.pushBackDays !== null) {
    await db.pets.update(pet.id, {
      nextFeedingOverride: pushBackOverride(parseISO(r.at), pet, r.pushBackDays),
      updatedAt: ts,
    });
  }
  return rec;
}

export async function logFeeding(input: LogFeedingInput): Promise<Feeding> {
  if (!input.foodItem.trim()) throw new ValidationError('Pick what it ate');
  validateQuantity(input.quantity);
  if (input.regurgitated && input.outcome !== 'ate') {
    throw new ValidationError('Only a meal it ate can be regurgitated');
  }
  return db.transaction('rw', [db.pets, db.feedings, db.regurgitations], async () => {
    const pet = await db.pets.get(input.petId);
    if (!pet) throw new Error(`Pet ${input.petId} not found`);
    const ts = nowIso();
    const feeding: Feeding = {
      id: newId(), petId: pet.id, at: input.at, foodItem: input.foodItem.trim(),
      quantity: input.quantity, outcome: input.outcome, notes: clean(input.notes),
      createdAt: ts, updatedAt: ts,
    };
    const previous = await listFeedings(pet.id);
    await db.feedings.add(feeding);
    if (input.outcome === 'ate') {
      // Spec §7 rule 4: the next eaten meal clears the push-back. A backfilled meal older than
      // the latest one it already ate is not "next", so it must leave an active push-back alone.
      const newest = previous.filter((f) => f.outcome === 'ate').reduce<number | undefined>(
        (max, f) => (max === undefined || Date.parse(f.at) > max ? Date.parse(f.at) : max), undefined);
      if (newest === undefined || Date.parse(input.at) > newest) {
        await db.pets.update(pet.id, { nextFeedingOverride: undefined, updatedAt: ts });
      }
    }
    if (input.regurgitated) {
      await addRegurgitation(pet, {
        feedingId: feeding.id,
        at: input.regurgitated.foundAt,
        pushBackDays: input.regurgitated.pushBackDays,
        notes: input.regurgitated.notes,
      });
    }
    return feeding;
  });
}

export async function logRegurgitation(input: LogRegurgitationInput): Promise<Regurgitation> {
  return db.transaction('rw', [db.pets, db.feedings, db.regurgitations], async () => {
    const pet = await db.pets.get(input.petId);
    if (!pet) throw new Error(`Pet ${input.petId} not found`);
    const meal = await db.feedings.get(input.feedingId);
    if (!meal || meal.petId !== pet.id || meal.outcome !== 'ate') {
      throw new ValidationError('Pick the meal that came back up');
    }
    return addRegurgitation(pet, input);
  });
}

/**
 * Removes a meal's regurgitations and, per spec §7 rule 4, undoes the push-back override
 * they created (only if the pet's current override is still exactly that push-back).
 * Must run inside a transaction that includes db.pets and db.regurgitations.
 */
async function removeRegurgitations(feedingId: string): Promise<void> {
  const linked = await db.regurgitations.where('feedingId').equals(feedingId).toArray();
  if (linked.length === 0) return;
  const pet = await db.pets.get(linked[0]!.petId);
  if (pet?.nextFeedingOverride) {
    const undone = linked.some(
      (r) => r.pushBackDays && pet.nextFeedingOverride === pushBackOverride(parseISO(r.at), pet, r.pushBackDays),
    );
    if (undone) await db.pets.update(pet.id, { nextFeedingOverride: undefined, updatedAt: nowIso() });
  }
  await db.regurgitations.where('feedingId').equals(feedingId).delete();
}

export async function updateFeeding(
  id: string,
  patch: Partial<Pick<Feeding, 'at' | 'foodItem' | 'quantity' | 'outcome' | 'notes'>>,
): Promise<void> {
  if (patch.quantity !== undefined) validateQuantity(patch.quantity);
  if (patch.foodItem !== undefined && !patch.foodItem.trim()) throw new ValidationError('Pick what it ate');
  const next: Partial<Feeding> = { ...patch, updatedAt: nowIso() };
  if ('notes' in patch) next.notes = clean(patch.notes); // an empty note removes it
  await db.transaction('rw', [db.pets, db.feedings, db.regurgitations], async () => {
    if (patch.outcome === 'refused') await removeRegurgitations(id); // a refused meal can't be regurgitated
    await db.feedings.update(id, next);
  });
}

export async function deleteFeeding(id: string): Promise<void> {
  await db.transaction('rw', [db.pets, db.feedings, db.regurgitations], async () => {
    await removeRegurgitations(id);
    await db.feedings.delete(id);
  });
}

export const listFeedings = (petId: string): Promise<Feeding[]> =>
  db.feedings.where('[petId+at]').between([petId, Dexie.minKey], [petId, Dexie.maxKey]).toArray();

export const listRegurgitations = (petId: string): Promise<Regurgitation[]> =>
  db.regurgitations.where('petId').equals(petId).toArray();
