import { beforeEach, expect, it } from 'vitest';
import { db, resetDb } from './db';
import { createPet } from './pets';
import {
  archiveCareTask, completeCareTask, createCareTask, deleteCareCompletion, listAllCompletions, listCareTasks,
  listCompletions, toggleCareToday, updateCareTask,
} from './care';
import { ValidationError } from './ids';

const iso = (d: number, h = 9) => new Date(2026, 10, d, h, 0).toISOString();
let noodle: string;
let ziggy: string;

beforeEach(async () => {
  await resetDb();
  noodle = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
  ziggy = (await createPet({ name: 'Ziggy', species: 'Leopard Gecko', feedingIntervalDays: 3 })).id;
});

it('lists a pet’s tasks plus All-pets tasks, A–Z, without archived ones', async () => {
  await createCareTask({ petId: noodle, name: 'Deep clean', intervalDays: 30 });
  await createCareTask({ name: '  Fresh water ', intervalDays: 2 });
  await createCareTask({ petId: ziggy, name: 'Mist', intervalDays: 2 });
  const old = await createCareTask({ petId: noodle, name: 'Check heat mat', intervalDays: 7 });
  await archiveCareTask(old.id);
  expect((await listCareTasks(noodle)).map((t) => t.name)).toEqual(['Deep clean', 'Fresh water']);
  expect((await listCareTasks()).map((t) => t.name)).toEqual(['Deep clean', 'Fresh water', 'Mist']);
  expect((await listCareTasks(noodle))[1]!.petId).toBeUndefined();
});

it('validates tasks', async () => {
  await expect(createCareTask({ petId: noodle, name: ' ', intervalDays: 1 })).rejects.toBeInstanceOf(ValidationError);
  await expect(createCareTask({ petId: noodle, name: 'Mist', intervalDays: 0 })).rejects.toBeInstanceOf(ValidationError);
  await expect(createCareTask({ petId: noodle, name: 'Mist', intervalDays: 1.5 })).rejects.toBeInstanceOf(ValidationError);
  await expect(createCareTask({ petId: noodle, name: 'Mist', intervalDays: 1, timeOfDay: '8am' })).rejects.toBeInstanceOf(ValidationError);
  await expect(createCareTask({ petId: noodle, name: 'Mist', intervalDays: 3651 })).rejects.toThrow('at most 3650');
  await expect(createCareTask({ petId: noodle, name: 'Mist', intervalDays: 1e9 })).rejects.toBeInstanceOf(ValidationError);
  await expect(createCareTask({ petId: noodle, name: 'Mist', intervalDays: 3650 })).resolves.toMatchObject({ intervalDays: 3650 });
  await expect(createCareTask({ petId: 'missing', name: 'Mist', intervalDays: 1 })).rejects.toThrow('not found');
});

it('updates a task and can clear its time and pet', async () => {
  const t = await createCareTask({ petId: noodle, name: 'Mist', intervalDays: 2, timeOfDay: '08:00' });
  await updateCareTask(t.id, { name: 'Mist humid hide', intervalDays: 3, timeOfDay: undefined, petId: undefined });
  const after = (await db.careTasks.get(t.id))!;
  expect(after).toMatchObject({ name: 'Mist humid hide', intervalDays: 3 });
  expect(after.timeOfDay).toBeUndefined();
  expect(after.petId).toBeUndefined();
  await expect(updateCareTask(t.id, { name: '' })).rejects.toBeInstanceOf(ValidationError);
});

it('records completions oldest first and deletes one', async () => {
  const t = await createCareTask({ petId: noodle, name: 'Spot clean', intervalDays: 1 });
  await completeCareTask(t.id, iso(8));
  const c = await completeCareTask(t.id, iso(6));
  expect((await listCompletions(t.id)).map((x) => x.at)).toEqual([iso(6), iso(8)]);
  await deleteCareCompletion(c.id);
  expect(await listAllCompletions()).toHaveLength(1);
  await expect(completeCareTask('missing', iso(8))).rejects.toThrow('not found');
});

it('toggleCareToday completes now, then undoes today', async () => {
  const t = await createCareTask({ petId: noodle, name: 'Spot clean', intervalDays: 1 });
  await completeCareTask(t.id, iso(7));
  const now = new Date(2026, 10, 8, 9, 30);
  await toggleCareToday(t.id, now);
  expect((await listCompletions(t.id)).map((x) => x.at)).toEqual([iso(7), now.toISOString()]);
  await toggleCareToday(t.id, now);
  expect((await listCompletions(t.id)).map((x) => x.at)).toEqual([iso(7)]);
});
