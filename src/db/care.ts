import Dexie from 'dexie';
import { isSameDay, parseISO } from 'date-fns';
import type { CareCompletion, CareTask } from '../domain/types';
import { isTimeOfDay } from '../domain/dates';
import { db } from './db';
import { newId, nowIso, requireDateTime, ValidationError } from './ids';

export interface CareTaskInput {
  /** Empty means all pets. */
  petId?: string;
  name: string;
  intervalDays: number;
  timeOfDay?: string;
}

function validate(p: Partial<CareTaskInput>): void {
  if (p.name !== undefined && !p.name.trim()) throw new ValidationError('Name the task');
  if (p.intervalDays !== undefined && !(Number.isInteger(p.intervalDays) && p.intervalDays >= 1)) {
    throw new ValidationError('Repeat every must be at least 1 day');
  }
  if (p.timeOfDay && !isTimeOfDay(p.timeOfDay)) throw new ValidationError('Pick a time of day');
}

export async function createCareTask(input: CareTaskInput): Promise<CareTask> {
  validate(input);
  if (input.petId && !(await db.pets.get(input.petId))) throw new Error(`Pet ${input.petId} not found`);
  const ts = nowIso();
  const task: CareTask = {
    id: newId(), petId: input.petId || undefined, name: input.name.trim(), intervalDays: input.intervalDays,
    timeOfDay: input.timeOfDay || undefined, createdAt: ts, updatedAt: ts,
  };
  await db.careTasks.add(task);
  return task;
}

/** Keys present with `undefined` are removed (no time of day; an All-pets task). */
export async function updateCareTask(id: string, patch: Partial<CareTaskInput>): Promise<void> {
  validate(patch);
  const next: Partial<CareTask> = { ...patch, updatedAt: nowIso() };
  if (patch.name !== undefined) next.name = patch.name.trim();
  if ('timeOfDay' in patch) next.timeOfDay = patch.timeOfDay || undefined;
  if ('petId' in patch) next.petId = patch.petId || undefined;
  const changed = await db.careTasks.update(id, next);
  if (!changed) throw new Error(`Care task ${id} not found`);
}

export async function archiveCareTask(id: string): Promise<void> {
  const ts = nowIso();
  const changed = await db.careTasks.update(id, { archivedAt: ts, updatedAt: ts });
  if (!changed) throw new Error(`Care task ${id} not found`);
}

export async function completeCareTask(taskId: string, at: string = nowIso()): Promise<CareCompletion> {
  requireDateTime(at);
  if (!(await db.careTasks.get(taskId))) throw new Error(`Care task ${taskId} not found`);
  const ts = nowIso();
  const c: CareCompletion = { id: newId(), taskId, at, createdAt: ts, updatedAt: ts };
  await db.careCompletions.add(c);
  return c;
}

export async function deleteCareCompletion(id: string): Promise<void> {
  await db.careCompletions.delete(id);
}

/** The checklist tick: undo today's completion if there is one, otherwise complete it now. */
export async function toggleCareToday(taskId: string, now: Date): Promise<void> {
  await db.transaction('rw', [db.careTasks, db.careCompletions], async () => {
    const all = await db.careCompletions.where('taskId').equals(taskId).toArray();
    const today = all.filter((c) => isSameDay(parseISO(c.at), now));
    if (today.length > 0) await db.careCompletions.bulkDelete(today.map((c) => c.id));
    else await completeCareTask(taskId, now.toISOString());
  });
}

/** Active tasks A–Z. With `petId`: that pet's tasks plus the All-pets tasks. */
export async function listCareTasks(petId?: string): Promise<CareTask[]> {
  const all = await db.careTasks.toArray();
  return all
    .filter((t) => !t.archivedAt && (petId === undefined || !t.petId || t.petId === petId))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const listCompletions = (taskId: string): Promise<CareCompletion[]> =>
  db.careCompletions.where('[taskId+at]').between([taskId, Dexie.minKey], [taskId, Dexie.maxKey]).toArray();

export const listAllCompletions = (): Promise<CareCompletion[]> => db.careCompletions.toArray();
