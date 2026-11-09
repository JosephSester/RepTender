import Dexie from 'dexie';
import type { Poop, PoopKind } from '../domain/types';
import { POOP_KINDS } from '../domain/poop';
import { db } from './db';
import { cleanText, newId, nowIso, requireDateTime, ValidationError } from './ids';

export interface PoopInput {
  petId: string;
  at: string;
  kind: PoopKind;
  notes?: string;
}

export async function logPoop(input: PoopInput): Promise<Poop> {
  requireDateTime(input.at, 'Pick when it happened');
  if (!POOP_KINDS.some((k) => k.value === input.kind)) throw new ValidationError('Pick what it looked like');
  return db.transaction('rw', [db.pets, db.poops], async () => {
    if (!(await db.pets.get(input.petId))) throw new Error(`Pet ${input.petId} not found`);
    const ts = nowIso();
    const poop: Poop = {
      id: newId(), petId: input.petId, at: input.at, kind: input.kind, notes: cleanText(input.notes),
      createdAt: ts, updatedAt: ts,
    };
    await db.poops.add(poop);
    return poop;
  });
}

export async function deletePoop(id: string): Promise<void> {
  await db.poops.delete(id);
}

export const listPoops = (petId: string): Promise<Poop[]> =>
  db.poops.where('[petId+at]').between([petId, Dexie.minKey], [petId, Dexie.maxKey]).toArray();
