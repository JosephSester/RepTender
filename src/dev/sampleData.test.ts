import { beforeEach, expect, it } from 'vitest';
import { resetDb } from '../db/db';
import { listActivePets } from '../db/pets';
import { listFeedings } from '../db/feedings';
import { sortSummaries, summarize } from '../features/pets/usePetSummaries';
import { loadSampleData } from './sampleData';

beforeEach(async () => {
  await resetDb();
});

it('creates four pets in every feeding state', async () => {
  const now = new Date(2026, 10, 8, 9, 0);
  await loadSampleData(now);
  const pets = await listActivePets();
  const summaries = sortSummaries(await Promise.all(pets.map(async (p) => summarize(p, await listFeedings(p.id), now))));
  expect(summaries.map((s) => [s.pet.name, s.label])).toEqual([
    ['Basil', '1 day late'],
    ['Noodle', 'Today'],
    ['Pebble', 'Tomorrow'],
    ['Ziggy', 'In 2 days'],
  ]);
});
