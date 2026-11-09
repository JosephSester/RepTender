import { useLiveQuery } from 'dexie-react-hooks';
import type { CareSource, FeedingSource } from '../../domain/schedule';
import { listActivePets } from '../../db/pets';
import { listFeedings } from '../../db/feedings';
import { listAllCompletions, listCareTasks } from '../../db/care';

export interface ScheduleSources {
  feedings: FeedingSource[];
  care: CareSource[];
}

/** Active pets with their feedings, and the care tasks of active pets plus All-pets tasks. */
export async function loadScheduleSources(): Promise<ScheduleSources> {
  const pets = await listActivePets();
  const byId = new Map(pets.map((p) => [p.id, p]));
  const feedings = await Promise.all(pets.map(async (pet) => ({ pet, feedings: await listFeedings(pet.id) })));
  const completions = await listAllCompletions();
  const care = (await listCareTasks())
    .filter((task) => !task.petId || byId.has(task.petId)) // hide tasks of archived pets
    .map((task) => ({
      task,
      pet: task.petId ? byId.get(task.petId) : undefined,
      completions: completions.filter((c) => c.taskId === task.id),
    }));
  return { feedings, care };
}

/** Live: Schedule, "Add all reminders" and the app badge all read the same data. */
export function useScheduleSources(): ScheduleSources | undefined {
  return useLiveQuery(loadScheduleSources, []);
}
