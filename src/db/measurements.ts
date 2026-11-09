import Dexie from 'dexie';
import type { Measurement } from '../domain/types';
import { db } from './db';
import { newId, nowIso, requireDateKey, ValidationError } from './ids';

export interface MeasurementInput {
  petId: string;
  date: string;
  weightG?: number;
  lengthMm?: number;
}

/** Spec §11 "sensible limits": up to 200 kg (a big tortoise) and 10 m (a big python). */
const MAX_WEIGHT_G = 200_000;
const MAX_LENGTH_MM = 10_000;

function validate(m: MeasurementInput): void {
  requireDateKey(m.date);
  if (m.weightG === undefined && m.lengthMm === undefined) throw new ValidationError('Enter a weight or a length');
  if (m.weightG !== undefined && !(Number.isFinite(m.weightG) && m.weightG > 0 && m.weightG <= MAX_WEIGHT_G)) {
    throw new ValidationError('Weight must be more than 0 and less than 200 kg');
  }
  if (m.lengthMm !== undefined && !(Number.isFinite(m.lengthMm) && m.lengthMm > 0 && m.lengthMm <= MAX_LENGTH_MM)) {
    throw new ValidationError('Length must be more than 0 and less than 10 m');
  }
}

export async function logMeasurement(input: MeasurementInput): Promise<Measurement> {
  validate(input);
  return db.transaction('rw', [db.pets, db.measurements], async () => {
    if (!(await db.pets.get(input.petId))) throw new Error(`Pet ${input.petId} not found`);
    const ts = nowIso();
    const m: Measurement = {
      id: newId(), petId: input.petId, date: input.date, weightG: input.weightG, lengthMm: input.lengthMm,
      createdAt: ts, updatedAt: ts,
    };
    await db.measurements.add(m);
    return m;
  });
}

export async function deleteMeasurement(id: string): Promise<void> {
  await db.measurements.delete(id);
}

export const listMeasurements = (petId: string): Promise<Measurement[]> =>
  db.measurements.where('[petId+date]').between([petId, Dexie.minKey], [petId, Dexie.maxKey]).toArray();
