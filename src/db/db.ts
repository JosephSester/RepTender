import Dexie, { type EntityTable } from 'dexie';
import type {
  CareCompletion, CareTask, Feeding, FoodItem, HabitatReading, Measurement, Note, Pet, Photo, Poop,
  Regurgitation, Settings, Shed, VetVisit,
} from '../domain/types';
import { newId, nowIso } from './ids';

export const SCHEMA_VERSION = 2;

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
  sheds!: EntityTable<Shed, 'id'>;
  poops!: EntityTable<Poop, 'id'>;
  measurements!: EntityTable<Measurement, 'id'>;
  habitatReadings!: EntityTable<HabitatReading, 'id'>;
  careTasks!: EntityTable<CareTask, 'id'>;
  careCompletions!: EntityTable<CareCompletion, 'id'>;
  vetVisits!: EntityTable<VetVisit, 'id'>;
  notes!: EntityTable<Note, 'id'>;

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
    // Plan 2: husbandry tables. Spec §6.2: [petId+at] on time-based logs, [petId+date] on date-based ones.
    this.version(2)
      .stores({
        sheds: 'id, petId, [petId+date]',
        poops: 'id, petId, [petId+at]',
        measurements: 'id, petId, [petId+date]',
        habitatReadings: 'id, petId, [petId+at]',
        careTasks: 'id, petId',
        careCompletions: 'id, taskId, [taskId+at]',
        vetVisits: 'id, petId, [petId+date]',
        notes: 'id, petId, [petId+at]',
      })
      .upgrade(async (tx) => {
        // v1 → v2 only adds tables; existing rows are untouched. The Habitat screen edits
        // pet.habitatTargets in place, so make sure every pet has the object.
        await tx.table('pets').toCollection().modify((pet: Partial<Pet>) => {
          if (!pet.habitatTargets) pet.habitatTargets = {};
        });
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
