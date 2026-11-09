import { beforeEach, expect, it } from 'vitest';
import { resetDb } from './db';
import { createPet } from './pets';
import { deletePoop, listPoops, logPoop } from './poops';
import { ValidationError } from './ids';

const at = (d: number, h = 8) => new Date(2026, 10, d, h, 0).toISOString();
let petId: string;

beforeEach(async () => {
  await resetDb();
  petId = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
});

it('logs poops, trims notes and lists them oldest first', async () => {
  await logPoop({ petId, at: at(6), kind: 'normal' });
  const runny = await logPoop({ petId, at: at(2), kind: 'runny', notes: '  a bit runny  ' });
  expect(runny.notes).toBe('a bit runny');
  expect((await listPoops(petId)).map((p) => p.at)).toEqual([at(2), at(6)]);
  await deletePoop(runny.id);
  expect(await listPoops(petId)).toHaveLength(1);
});

it('rejects a bad time, a bad kind and a missing pet', async () => {
  await expect(logPoop({ petId, at: '', kind: 'normal' })).rejects.toBeInstanceOf(ValidationError);
  // @ts-expect-error not a PoopKind
  await expect(logPoop({ petId, at: at(6), kind: 'green' })).rejects.toBeInstanceOf(ValidationError);
  await expect(logPoop({ petId: 'missing', at: at(6), kind: 'normal' })).rejects.toThrow('not found');
  expect(await listPoops(petId)).toEqual([]);
});
