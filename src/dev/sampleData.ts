import { addDays, startOfDay, subMonths } from 'date-fns';
import { createPet } from '../db/pets';
import { logFeeding } from '../db/feedings';
import { dateKey } from '../domain/dates';
import type { FeedingOutcome } from '../domain/types';

/** Dev builds only: the four pets from the approved mockups, with history relative to `now`. */
export async function loadSampleData(now: Date = new Date()): Promise<void> {
  const at = (offsetDays: number, hour = 18) => {
    const d = addDays(startOfDay(now), offsetDays);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
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
}
