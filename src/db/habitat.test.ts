import { beforeEach, expect, it } from 'vitest';
import { resetDb } from './db';
import { createPet, getPet } from './pets';
import { deleteHabitatReading, listHabitatReadings, logHabitatReading, updateHabitatSetup } from './habitat';
import { ValidationError } from './ids';

const at = (d: number) => new Date(2026, 10, d, 8, 15).toISOString();
let petId: string;

beforeEach(async () => {
  await resetDb();
  petId = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
});

it('logs readings with any one value, oldest first, and deletes them', async () => {
  await logHabitatReading({ petId, at: at(8), warmC: 31.1, coolC: 23.3, humidityPct: 52 });
  const first = await logHabitatReading({ petId, at: at(7), humidityPct: 60 });
  expect((await listHabitatReadings(petId)).map((r) => r.at)).toEqual([at(7), at(8)]);
  await deleteHabitatReading(first.id);
  expect(await listHabitatReadings(petId)).toHaveLength(1);
});

it('validates readings (spec §11)', async () => {
  const bad = [
    { petId, at: at(8) },
    { petId, at: at(8), warmC: 0 },
    { petId, at: at(8), coolC: 75 },
    { petId, at: at(8), humidityPct: 101 },
    { petId, at: at(8), humidityPct: -1 },
    { petId, at: 'not a date', warmC: 30 },
  ];
  for (const input of bad) await expect(logHabitatReading(input)).rejects.toBeInstanceOf(ValidationError);
  await expect(logHabitatReading({ petId: 'missing', at: at(8), warmC: 30 })).rejects.toThrow('not found');
  expect(await listHabitatReadings(petId)).toEqual([]);
});

it('saves the enclosure label and targets, dropping blanks', async () => {
  await updateHabitatSetup(petId, {
    enclosureLabel: '  40-gal tank ',
    habitatTargets: { warmMinC: 29.4, warmMaxC: 32.2, coolMinC: undefined, humidityMin: 40, humidityMax: 60 },
  });
  const pet = (await getPet(petId))!;
  expect(pet.enclosureLabel).toBe('40-gal tank');
  expect(pet.habitatTargets).toEqual({ warmMinC: 29.4, warmMaxC: 32.2, humidityMin: 40, humidityMax: 60 });

  await updateHabitatSetup(petId, { enclosureLabel: '', habitatTargets: {} });
  expect((await getPet(petId))!.enclosureLabel).toBeUndefined();
  expect((await getPet(petId))!.habitatTargets).toEqual({});
});

it('rejects a minimum above its maximum and out-of-range targets', async () => {
  await expect(updateHabitatSetup(petId, { habitatTargets: { warmMinC: 33, warmMaxC: 30 } })).rejects.toThrow(
    'Warm side minimum must not be above the maximum',
  );
  await expect(updateHabitatSetup(petId, { habitatTargets: { humidityMax: 120 } })).rejects.toBeInstanceOf(ValidationError);
  await expect(updateHabitatSetup(petId, { habitatTargets: { coolMinC: -5 } })).rejects.toBeInstanceOf(ValidationError);
  await expect(updateHabitatSetup('missing', { habitatTargets: {} })).rejects.toThrow('not found');
});
