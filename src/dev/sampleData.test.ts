import { beforeEach, expect, it } from 'vitest';
import { resetDb } from '../db/db';
import { listActivePets } from '../db/pets';
import { listFeedings } from '../db/feedings';
import { listSheds } from '../db/sheds';
import { listPoops } from '../db/poops';
import { listMeasurements } from '../db/measurements';
import { listHabitatReadings } from '../db/habitat';
import { listCareTasks } from '../db/care';
import { listVetVisits } from '../db/vetVisits';
import { listNotes } from '../db/notes';
import { predictNextShed, shedEtaLabel } from '../domain/sheds';
import { sortSummaries, summarize } from '../features/pets/usePetSummaries';
import { loadSampleData } from './sampleData';

const now = new Date(2026, 10, 8, 9, 0);

beforeEach(async () => {
  await resetDb();
});

it('creates four pets in every feeding state', async () => {
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

it('adds husbandry history so every Plan 2 screen has something to show', async () => {
  await loadSampleData(now);
  const pets = await listActivePets();
  const noodle = pets.find((p) => p.name === 'Noodle')!;
  const basil = pets.find((p) => p.name === 'Basil')!;

  const prediction = predictNextShed(await listSheds(noodle.id))!;
  expect(prediction.averageDays).toBe(33);
  expect(shedEtaLabel(prediction.date, now)).toBe('In 15 days');
  expect(noodle.enclosureLabel).toBe('40-gal tank');
  expect(await listPoops(noodle.id)).toHaveLength(2);
  expect((await listPoops(basil.id))[0]).toMatchObject({ kind: 'runny' });
  expect((await listMeasurements(noodle.id)).at(-1)).toMatchObject({ weightG: 42, lengthMm: 457.2 });
  expect(await listHabitatReadings(noodle.id)).toHaveLength(7);
  expect(await listVetVisits(noodle.id)).toHaveLength(2);
  expect(await listNotes(noodle.id)).toHaveLength(3);
  expect((await listCareTasks()).map((t) => t.name)).toEqual(['Deep clean', 'Fresh water', 'Mist', 'Replace UVB bulb', 'Spot clean']);
});
