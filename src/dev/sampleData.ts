import { addDays, startOfDay, subMonths } from 'date-fns';
import { createPet } from '../db/pets';
import { logFeeding } from '../db/feedings';
import { logShed } from '../db/sheds';
import { logPoop } from '../db/poops';
import { logMeasurement } from '../db/measurements';
import { logHabitatReading, updateHabitatSetup } from '../db/habitat';
import { completeCareTask, createCareTask } from '../db/care';
import { createVetVisit } from '../db/vetVisits';
import { addNote } from '../db/notes';
import { dateKey } from '../domain/dates';
import { tempToC } from '../domain/units';
import type { FeedingOutcome, ShedQuality } from '../domain/types';

/** Dev builds only: the four pets from the approved mockups, with history relative to `now`. */
export async function loadSampleData(now: Date = new Date()): Promise<void> {
  const at = (offsetDays: number, hour = 18, minute = 0) => {
    const d = addDays(startOfDay(now), offsetDays);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };
  const day = (offsetDays: number) => dateKey(addDays(now, offsetDays));
  const f = (deg: number) => tempToC(deg, 'F');
  const meals = async (
    petId: string, foodItem: string, quantity: number, entries: [number, FeedingOutcome?][],
  ) => {
    for (const [offset, outcome = 'ate'] of entries) {
      await logFeeding({ petId, at: at(offset), foodItem, quantity, outcome });
    }
  };

  const noodle = await createPet({
    name: 'Noodle', species: 'Corn Snake', morph: 'Amel', sex: 'female', origin: 'captive_bred',
    birthDate: dateKey(subMonths(now, 8)), feedingIntervalDays: 5, usualFoodItem: 'Pinky mouse',
    sire: { name: 'Apollo', morph: 'Amel' }, dam: { name: 'Juniper', morph: 'Anery' },
    acquiredFrom: 'Scales & Tails Reptiles', acquiredDate: dateKey(subMonths(now, 7)), pricePaid: 65,
    description: 'Calm, great eater. Likes the cork bark hide on the warm side.',
  });
  await meals(noodle.id, 'Pinky mouse', 1, [[-15], [-10], [-6, 'refused'], [-5]]); // due today

  const ziggy = await createPet({
    name: 'Ziggy', species: 'Leopard Gecko', morph: 'Tangerine', sex: 'male',
    feedingIntervalDays: 3, usualFoodItem: 'Crickets', usualQuantity: 8,
  });
  await meals(ziggy.id, 'Crickets', 8, [[-7], [-4], [-1]]); // due in 2 days

  const basil = await createPet({
    name: 'Basil', species: 'Bearded Dragon', feedingIntervalDays: 2,
    usualFoodItem: 'Dubia roaches', usualQuantity: 12,
  });
  await meals(basil.id, 'Dubia roaches', 12, [[-7], [-5], [-3]]); // 1 day late

  const pebble = await createPet({
    name: 'Pebble', species: 'Russian Tortoise', feedingIntervalDays: 2, usualFoodItem: 'Greens',
  });
  await meals(pebble.id, 'Greens', 1, [[-5], [-3], [-1]]); // due tomorrow

  // ---- Plan 2 husbandry history (mockup ①–⑧ values) ----

  // Sheds every 33 days → next one "In 15 days".
  const sheds: { offset: number; quality: ShedQuality; notes?: string; inBlue?: number }[] = [
    { offset: -117, quality: 'complete' },
    { offset: -84, quality: 'partial', notes: 'Stuck shed on the tail tip, soaked 15 min' },
    { offset: -51, quality: 'complete' },
    { offset: -18, quality: 'complete', inBlue: -25 },
  ];
  for (const s of sheds) {
    await logShed({
      petId: noodle.id, date: day(s.offset), quality: s.quality, notes: s.notes,
      inBlueDate: s.inBlue === undefined ? undefined : day(s.inBlue),
    });
  }

  await logPoop({ petId: noodle.id, at: at(-12, 9), kind: 'normal' }); // 3 days after the -15 meal
  await logPoop({ petId: noodle.id, at: at(-2, 8), kind: 'normal' }); // 3 days after the -5 meal
  await logPoop({ petId: basil.id, at: at(-1, 10), kind: 'runny', notes: 'A bit runny' });

  await logMeasurement({ petId: noodle.id, date: day(-97), weightG: 30, lengthMm: 406.4 });
  await logMeasurement({ petId: noodle.id, date: day(-67), weightG: 33 });
  await logMeasurement({ petId: noodle.id, date: day(-37), weightG: 39, lengthMm: 431.8 });
  await logMeasurement({ petId: noodle.id, date: day(-7), weightG: 42, lengthMm: 457.2 });

  await updateHabitatSetup(noodle.id, {
    enclosureLabel: '40-gal tank',
    habitatTargets: { warmMinC: f(85), warmMaxC: f(90), coolMinC: f(72), coolMaxC: f(78), humidityMin: 40, humidityMax: 60 },
  });
  for (let offset = -6; offset <= 0; offset++) {
    await logHabitatReading({ petId: noodle.id, at: at(offset, 8, 15), warmC: f(88), coolC: f(74), humidityPct: 52 });
  }

  const tasks: { petId?: string; name: string; intervalDays: number; doneAt: string }[] = [
    { petId: basil.id, name: 'Spot clean', intervalDays: 1, doneAt: at(-1, 9) }, // due today
    { name: 'Fresh water', intervalDays: 2, doneAt: at(-2, 9) }, // due today, all pets
    { petId: ziggy.id, name: 'Mist', intervalDays: 2, doneAt: at(-1, 20) }, // tomorrow
    { petId: noodle.id, name: 'Deep clean', intervalDays: 30, doneAt: at(-23, 10) }, // in 7 days
    { petId: basil.id, name: 'Replace UVB bulb', intervalDays: 180, doneAt: at(-150, 10) },
  ];
  for (const t of tasks) {
    const task = await createCareTask({ petId: t.petId, name: t.name, intervalDays: t.intervalDays });
    await completeCareTask(task.id, t.doneAt);
  }

  await createVetVisit({
    petId: noodle.id, date: day(-202), reason: 'New-pet check', clinic: 'Exotic Animal Clinic',
    notes: 'No mites, good body condition.',
  });
  await createVetVisit({
    petId: noodle.id, date: day(-147), reason: 'Wellness exam', clinic: 'Exotic Animal Clinic', vet: 'Dr. Patel',
    phone: '(555) 201-4470', cost: 85, notes: 'Healthy. Weight 28 g. Fecal test negative.',
    nextAppointment: at(218, 10),
  });

  await addNote({ petId: noodle.id, at: at(-20, 19), text: 'Eyes going blue, skipped handling.' });
  await addNote({ petId: noodle.id, at: at(-9, 20), text: 'Moved the cork bark hide to the warm side.' });
  await addNote({ petId: noodle.id, at: at(-1, 19), text: 'Very active tonight.' });
}
