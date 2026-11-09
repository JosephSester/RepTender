import { beforeEach, expect, it } from 'vitest';
import { resetDb } from './db';
import { createPet, getPet } from './pets';
import { clearInBlue, deleteShed, listSheds, logShed, markInBlue } from './sheds';
import { ValidationError } from './ids';

let petId: string;

beforeEach(async () => {
  await resetDb();
  petId = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
});

it('logs sheds oldest first and deletes them', async () => {
  await logShed({ petId, date: '2026-10-21', quality: 'complete', inBlueDate: '2026-10-14' });
  const stuck = await logShed({ petId, date: '2026-08-16', quality: 'stuck', notes: ' tail tip ' });
  expect(stuck.notes).toBe('tail tip');
  expect((await listSheds(petId)).map((s) => s.date)).toEqual(['2026-08-16', '2026-10-21']);
  await deleteShed(stuck.id);
  expect(await listSheds(petId)).toHaveLength(1);
});

it('logging the shed clears "in blue"; a backfilled older shed does not', async () => {
  await markInBlue(petId, '2026-11-04');
  expect((await getPet(petId))!.inBlueSince).toBe('2026-11-04');
  await logShed({ petId, date: '2026-09-18', quality: 'complete' });
  expect((await getPet(petId))!.inBlueSince).toBe('2026-11-04');
  await logShed({ petId, date: '2026-11-08', quality: 'complete', inBlueDate: '2026-11-04' });
  expect((await getPet(petId))!.inBlueSince).toBeUndefined();
});

it('clearInBlue removes the mark', async () => {
  await markInBlue(petId, '2026-11-04');
  await clearInBlue(petId);
  expect((await getPet(petId))!.inBlueSince).toBeUndefined();
});

it('rejects bad dates and a missing pet', async () => {
  await expect(logShed({ petId, date: '', quality: 'complete' })).rejects.toBeInstanceOf(ValidationError);
  await expect(
    logShed({ petId, date: '2026-11-08', quality: 'complete', inBlueDate: '2026-11-09' }),
  ).rejects.toThrow('on or before the shed date');
  await expect(logShed({ petId: 'missing', date: '2026-11-08', quality: 'complete' })).rejects.toThrow('not found');
  await expect(markInBlue('missing', '2026-11-08')).rejects.toThrow('not found');
  expect(await listSheds(petId)).toEqual([]);
});
