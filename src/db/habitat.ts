import Dexie from 'dexie';
import type { HabitatReading, HabitatTargets } from '../domain/types';
import { db } from './db';
import { cleanText, newId, nowIso, requireDateTime, ValidationError } from './ids';

export interface HabitatReadingInput {
  petId: string;
  at: string;
  warmC?: number;
  coolC?: number;
  humidityPct?: number;
}

export interface HabitatSetup {
  enclosureLabel?: string;
  habitatTargets: HabitatTargets;
}

/** Spec §11: temperatures positive and sensible (up to 60 °C / 140 °F); humidity 0–100. */
const MAX_TEMP_C = 60;

function checkTemp(v: number | undefined, side: string): void {
  if (v !== undefined && !(Number.isFinite(v) && v > 0 && v <= MAX_TEMP_C)) {
    throw new ValidationError(`${side} temperature is out of range`);
  }
}

function checkHumidity(v: number | undefined): void {
  if (v !== undefined && !(Number.isFinite(v) && v >= 0 && v <= 100)) throw new ValidationError('Humidity must be 0–100%');
}

export async function logHabitatReading(input: HabitatReadingInput): Promise<HabitatReading> {
  requireDateTime(input.at);
  if (input.warmC === undefined && input.coolC === undefined && input.humidityPct === undefined) {
    throw new ValidationError('Enter at least one reading');
  }
  checkTemp(input.warmC, 'Warm side');
  checkTemp(input.coolC, 'Cool side');
  checkHumidity(input.humidityPct);
  return db.transaction('rw', [db.pets, db.habitatReadings], async () => {
    if (!(await db.pets.get(input.petId))) throw new Error(`Pet ${input.petId} not found`);
    const ts = nowIso();
    const r: HabitatReading = {
      id: newId(), petId: input.petId, at: input.at, warmC: input.warmC, coolC: input.coolC,
      humidityPct: input.humidityPct, createdAt: ts, updatedAt: ts,
    };
    await db.habitatReadings.add(r);
    return r;
  });
}

export async function deleteHabitatReading(id: string): Promise<void> {
  await db.habitatReadings.delete(id);
}

export const listHabitatReadings = (petId: string): Promise<HabitatReading[]> =>
  db.habitatReadings.where('[petId+at]').between([petId, Dexie.minKey], [petId, Dexie.maxKey]).toArray();

function checkPair(min: number | undefined, max: number | undefined, name: string, check: (v: number | undefined) => void): void {
  check(min);
  check(max);
  if (min !== undefined && max !== undefined && min > max) {
    throw new ValidationError(`${name} minimum must not be above the maximum`);
  }
}

/** Spec §5.9: the enclosure label and the target ranges (°C and %), stored on the pet. */
export async function updateHabitatSetup(petId: string, setup: HabitatSetup): Promise<void> {
  const t = setup.habitatTargets;
  checkPair(t.warmMinC, t.warmMaxC, 'Warm side', (v) => checkTemp(v, 'Warm side'));
  checkPair(t.coolMinC, t.coolMaxC, 'Cool side', (v) => checkTemp(v, 'Cool side'));
  checkPair(t.humidityMin, t.humidityMax, 'Humidity', checkHumidity);
  const habitatTargets = Object.fromEntries(Object.entries(t).filter(([, v]) => v !== undefined)) as HabitatTargets;
  const changed = await db.pets.update(petId, {
    enclosureLabel: cleanText(setup.enclosureLabel),
    habitatTargets,
    updatedAt: nowIso(),
  });
  if (!changed) throw new Error(`Pet ${petId} not found`);
}
