import Dexie, { type EntityTable } from 'dexie';
import type { Feeding, FoodItem, Pet, Photo, Regurgitation, Settings } from '../domain/types';
import { newId, nowIso } from './ids';

export const DEFAULT_FOOD_ITEMS = [
  'Pinky mouse', 'Fuzzy mouse', 'Hopper mouse', 'Adult mouse', 'Rat pup',
  'Crickets', 'Dubia roaches', 'Mealworms', 'Superworms', 'Greens', 'Pellets',
];

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings', theme: 'auto', tempUnit: 'F', weightUnit: 'g', lengthUnit: 'in',
};

export class RepTenderDB extends Dexie {
  pets!: EntityTable<Pet, 'id'>;
  feedings!: EntityTable<Feeding, 'id'>;
  regurgitations!: EntityTable<Regurgitation, 'id'>;
  photos!: EntityTable<Photo, 'id'>;
  foodItems!: EntityTable<FoodItem, 'id'>;
  settings!: EntityTable<Settings, 'id'>;

  constructor(name = 'reptender') {
    super(name);
    this.version(1).stores({
      pets: 'id, name, archivedAt',
      feedings: 'id, petId, [petId+at]',
      regurgitations: 'id, petId, feedingId, [petId+at]',
      photos: 'id',
      foodItems: 'id, &name',
      settings: 'id',
    });
    this.on('populate', (tx) => {
      const ts = nowIso();
      tx.table('foodItems').bulkAdd(
        DEFAULT_FOOD_ITEMS.map((name) => ({ id: newId(), name, isCustom: false, createdAt: ts, updatedAt: ts })),
      );
      tx.table('settings').add(DEFAULT_SETTINGS);
    });
  }
}

export const db = new RepTenderDB();

/** Tests only: wipe and recreate the database (re-runs the seed). */
export async function resetDb(): Promise<void> {
  db.close();
  await db.delete();
  await db.open();
}
