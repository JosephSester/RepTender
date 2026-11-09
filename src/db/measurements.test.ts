import { beforeEach, expect, it } from 'vitest';
import { resetDb } from './db';
import { createPet } from './pets';
import { deleteMeasurement, listMeasurements, logMeasurement } from './measurements';
import { ValidationError } from './ids';

let petId: string;

beforeEach(async () => {
  await resetDb();
  petId = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
});

it('logs weight and/or length, lists oldest first and deletes', async () => {
  await logMeasurement({ petId, date: '2026-11-01', weightG: 42, lengthMm: 457.2 });
  const first = await logMeasurement({ petId, date: '2026-10-01', lengthMm: 431.8 });
  expect(first.weightG).toBeUndefined();
  expect((await listMeasurements(petId)).map((x) => x.date)).toEqual(['2026-10-01', '2026-11-01']);
  await deleteMeasurement(first.id);
  expect(await listMeasurements(petId)).toHaveLength(1);
});

it('needs at least one value, positive and within sensible limits (spec §11)', async () => {
  const bad = [
    { petId, date: '2026-11-01' },
    { petId, date: '2026-11-01', weightG: 0 },
    { petId, date: '2026-11-01', weightG: 250_000 },
    { petId, date: '2026-11-01', lengthMm: -5 },
    { petId, date: '2026-11-01', lengthMm: Number.NaN },
    { petId, date: '', weightG: 42 },
  ];
  for (const input of bad) await expect(logMeasurement(input)).rejects.toBeInstanceOf(ValidationError);
  await expect(logMeasurement({ petId: 'missing', date: '2026-11-01', weightG: 42 })).rejects.toThrow('not found');
  expect(await listMeasurements(petId)).toEqual([]);
});
