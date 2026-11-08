import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb } from './db';
import { archivePet, createPet, deletePet, getPet, listActivePets, updatePet } from './pets';
import {
  deleteFeeding, listFeedings, listRegurgitations, logFeeding, logRegurgitation,
} from './feedings';
import { getSettings, updateSettings } from './settings';
import { addFoodItem, listFoodItems } from './foodItems';
import { ValidationError } from './ids';
import { pushBackOverride } from '../domain/feeding';

const at = (d: number, h = 18, m = 0) => new Date(2026, 10, d, h, m).toISOString();
const noodle = () => createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });

beforeEach(async () => {
  await resetDb();
});

describe('seed data', () => {
  it('seeds food items in a sensible order and default settings', async () => {
    const foods = await listFoodItems();
    expect(foods).toHaveLength(11);
    expect(foods[0]!.name).toBe('Pinky mouse');
    expect((await getSettings()).theme).toBe('auto');
  });
});

describe('pets', () => {
  it('creates a pet with defaults', async () => {
    const p = await noodle();
    expect(p).toMatchObject({
      name: 'Noodle', sex: 'unknown', origin: 'unknown', usualQuantity: 1,
      usualFeedTime: '18:00', birthDateApprox: false, habitatTargets: {},
    });
    expect(await getPet(p.id)).toEqual(p);
  });

  it('rejects a blank name and a zero interval', async () => {
    await expect(createPet({ name: ' ', species: 'Gecko', feedingIntervalDays: 3 })).rejects.toBeInstanceOf(ValidationError);
    await expect(createPet({ name: 'Ziggy', species: 'Gecko', feedingIntervalDays: 0 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('updates fields and clears optional ones', async () => {
    const p = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5, morph: 'Amel' });
    await updatePet(p.id, { morph: undefined, feedingIntervalDays: 7 });
    const after = (await getPet(p.id))!;
    expect(after.morph).toBeUndefined();
    expect(after.feedingIntervalDays).toBe(7);
  });

  it('lists active pets A–Z and hides archived ones', async () => {
    await createPet({ name: 'Ziggy', species: 'Leopard Gecko', feedingIntervalDays: 3 });
    const basil = await createPet({ name: 'Basil', species: 'Bearded Dragon', feedingIntervalDays: 2 });
    const pebble = await createPet({ name: 'Pebble', species: 'Russian Tortoise', feedingIntervalDays: 2 });
    await archivePet(pebble.id);
    expect((await listActivePets()).map((p) => p.name)).toEqual(['Basil', 'Ziggy']);
    expect(basil.id).toBeTruthy();
  });

  it('deleting a pet deletes its feedings and regurgitations', async () => {
    const p = await noodle();
    await logFeeding({
      petId: p.id, at: at(3), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate',
      regurgitated: { foundAt: at(4, 7, 30), pushBackDays: 10 },
    });
    await deletePet(p.id);
    expect(await db.feedings.count()).toBe(0);
    expect(await db.regurgitations.count()).toBe(0);
    expect(await getPet(p.id)).toBeUndefined();
  });
});

describe('feedings', () => {
  it('lists feedings oldest first', async () => {
    const p = await noodle();
    await logFeeding({ petId: p.id, at: at(8), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate' });
    await logFeeding({ petId: p.id, at: at(3), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate' });
    expect((await listFeedings(p.id)).map((f) => f.at)).toEqual([at(3), at(8)]);
  });

  it('an eaten meal clears a push-back override; a refusal keeps it', async () => {
    const p = await noodle();
    await updatePet(p.id, { nextFeedingOverride: at(20) });
    await logFeeding({ petId: p.id, at: at(9), foodItem: 'Pinky mouse', quantity: 1, outcome: 'refused' });
    expect((await getPet(p.id))!.nextFeedingOverride).toBe(at(20));
    await logFeeding({ petId: p.id, at: at(10), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate' });
    expect((await getPet(p.id))!.nextFeedingOverride).toBeUndefined();
  });

  it('Regurgitated creates both records and pushes the next feeding back', async () => {
    const p = await noodle();
    const meal = await logFeeding({
      petId: p.id, at: at(3), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate',
      regurgitated: { foundAt: at(4, 7, 30), pushBackDays: 10, notes: 'check heat mat' },
    });
    const [r] = await listRegurgitations(p.id);
    expect(r).toMatchObject({ feedingId: meal.id, at: at(4, 7, 30), pushBackDays: 10, notes: 'check heat mat' });
    expect((await getPet(p.id))!.nextFeedingOverride).toBe(pushBackOverride(new Date(at(4, 7, 30)), p, 10));
  });

  it('Regurgitated with push-back off sets no override', async () => {
    const p = await noodle();
    await logFeeding({
      petId: p.id, at: at(3), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate',
      regurgitated: { foundAt: at(3, 20), pushBackDays: null },
    });
    expect((await getPet(p.id))!.nextFeedingOverride).toBeUndefined();
    expect(await db.regurgitations.count()).toBe(1);
  });

  it('rejects bad input and saves nothing', async () => {
    const p = await noodle();
    await expect(
      logFeeding({ petId: p.id, at: at(3), foodItem: 'Pinky mouse', quantity: 0, outcome: 'ate' }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      logFeeding({
        petId: p.id, at: at(3), foodItem: 'Pinky mouse', quantity: 1, outcome: 'refused',
        regurgitated: { foundAt: at(3), pushBackDays: 10 },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      logFeeding({
        petId: p.id, at: at(3), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate',
        regurgitated: { foundAt: at(3), pushBackDays: 0 },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await db.feedings.count()).toBe(0);
  });

  it('logRegurgitation links to an earlier meal and rejects a refusal', async () => {
    const p = await noodle();
    const meal = await logFeeding({ petId: p.id, at: at(3), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate' });
    const refused = await logFeeding({ petId: p.id, at: at(5), foodItem: 'Pinky mouse', quantity: 1, outcome: 'refused' });
    await logRegurgitation({ petId: p.id, feedingId: meal.id, at: at(4, 7, 30), pushBackDays: 10 });
    expect((await getPet(p.id))!.nextFeedingOverride).toBe(pushBackOverride(new Date(at(4, 7, 30)), p, 10));
    await expect(
      logRegurgitation({ petId: p.id, feedingId: refused.id, at: at(5, 20), pushBackDays: null }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('deleting a feeding deletes its regurgitation', async () => {
    const p = await noodle();
    const meal = await logFeeding({
      petId: p.id, at: at(3), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate',
      regurgitated: { foundAt: at(4), pushBackDays: null },
    });
    await deleteFeeding(meal.id);
    expect(await db.feedings.count()).toBe(0);
    expect(await db.regurgitations.count()).toBe(0);
  });
});

describe('settings and food items', () => {
  it('merges settings updates', async () => {
    await updateSettings({ theme: 'dark' });
    expect(await getSettings()).toMatchObject({ theme: 'dark', tempUnit: 'F', weightUnit: 'g' });
  });
  it('adds a custom food once, case-insensitively, after the seeded ones', async () => {
    const a = await addFoodItem('Black soldier fly larvae');
    const b = await addFoodItem('black soldier fly larvae');
    expect(b.id).toBe(a.id);
    const foods = await listFoodItems();
    expect(foods.at(-1)!.name).toBe('Black soldier fly larvae');
    await expect(addFoodItem('  ')).rejects.toBeInstanceOf(ValidationError);
  });
});
