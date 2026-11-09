import { beforeEach, expect, it } from 'vitest';
import { resetDb } from './db';
import { createPet, getPet, updatePet } from './pets';

beforeEach(async () => {
  await resetDb();
});

it('rejects a feeding interval over 365 days on create and update', async () => {
  await expect(createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 366 })).rejects.toThrow(
    'Feed every must be 1 to 365 days',
  );
  const p = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 365 });
  await expect(updatePet(p.id, { feedingIntervalDays: 999999999 })).rejects.toThrow('Feed every must be 1 to 365 days');
  await expect(updatePet(p.id, { feedingIntervalDays: 0 })).rejects.toThrow('Feed every must be 1 to 365 days');
  expect((await getPet(p.id))!.feedingIntervalDays).toBe(365);
});
