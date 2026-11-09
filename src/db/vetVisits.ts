import Dexie from 'dexie';
import type { VetVisit } from '../domain/types';
import { db } from './db';
import { cleanText, newId, nowIso, requireDateKey, requireDateTime, ValidationError } from './ids';

export interface VetVisitInput {
  petId: string;
  date: string;
  clinic?: string;
  vet?: string;
  phone?: string;
  reason?: string;
  notes?: string;
  cost?: number;
  photoIds?: string[];
  nextAppointment?: string;
}

type VetVisitPatch = Partial<Omit<VetVisitInput, 'petId'>>;

const TEXT_FIELDS = ['clinic', 'vet', 'phone', 'reason', 'notes'] as const;

function validate(p: VetVisitPatch): void {
  if (p.date !== undefined) requireDateKey(p.date, 'Pick the visit date');
  if (p.cost !== undefined && !(Number.isFinite(p.cost) && p.cost >= 0)) throw new ValidationError('Cost must be a number');
  if (p.nextAppointment !== undefined) requireDateTime(p.nextAppointment, 'Pick the appointment date and time');
}

/** Trims the text fields; a blank one becomes undefined (removed on update). */
function withCleanText(p: VetVisitPatch): Partial<VetVisit> {
  const out: Partial<VetVisit> = { ...p };
  for (const key of TEXT_FIELDS) if (key in p) out[key] = cleanText(p[key]);
  return out;
}

export async function createVetVisit(input: VetVisitInput): Promise<VetVisit> {
  requireDateKey(input.date, 'Pick the visit date');
  validate(input);
  return db.transaction('rw', [db.pets, db.vetVisits], async () => {
    if (!(await db.pets.get(input.petId))) throw new Error(`Pet ${input.petId} not found`);
    const ts = nowIso();
    const visit: VetVisit = {
      ...withCleanText(input),
      id: newId(),
      petId: input.petId,
      date: input.date,
      photoIds: input.photoIds ?? [],
      createdAt: ts,
      updatedAt: ts,
    };
    await db.vetVisits.add(visit);
    return visit;
  });
}

export async function updateVetVisit(id: string, patch: VetVisitPatch): Promise<void> {
  validate(patch);
  await db.transaction('rw', [db.vetVisits, db.photos], async () => {
    const visit = await db.vetVisits.get(id);
    if (!visit) throw new Error(`Vet visit ${id} not found`);
    if (patch.photoIds) {
      const kept = new Set(patch.photoIds);
      await db.photos.bulkDelete(visit.photoIds.filter((p) => !kept.has(p)));
    }
    await db.vetVisits.update(id, { ...withCleanText(patch), updatedAt: nowIso() });
  });
}

export async function deleteVetVisit(id: string): Promise<void> {
  await db.transaction('rw', [db.vetVisits, db.photos], async () => {
    const visit = await db.vetVisits.get(id);
    if (!visit) return;
    await db.photos.bulkDelete(visit.photoIds);
    await db.vetVisits.delete(id);
  });
}

export const listVetVisits = (petId: string): Promise<VetVisit[]> =>
  db.vetVisits.where('[petId+date]').between([petId, Dexie.minKey], [petId, Dexie.maxKey]).toArray();
