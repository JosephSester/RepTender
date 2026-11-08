import { useLiveQuery } from 'dexie-react-hooks';
import type { Feeding, Pet } from '../../domain/types';
import {
  dueStatus, intervalProgress, lastMeal, nextFeedingDue, statusLabel, type DueStatus,
} from '../../domain/feeding';
import { listActivePets } from '../../db/pets';
import { listFeedings } from '../../db/feedings';

export interface PetSummary {
  pet: Pet;
  meal?: Feeding;
  due: Date | null;
  status: DueStatus;
  label: string;
  progress: number;
}

export function summarize(pet: Pet, feedings: Feeding[], now: Date): PetSummary {
  const meal = lastMeal(feedings);
  const due = nextFeedingDue(pet, feedings);
  return {
    pet,
    meal,
    due,
    status: dueStatus(due, now),
    label: statusLabel(due, now),
    progress: intervalProgress(meal, due, now),
  };
}

const RANK: Record<DueStatus, number> = { late: 0, today: 1, soon: 2 };

export function sortSummaries(list: PetSummary[]): PetSummary[] {
  return [...list].sort(
    (a, b) =>
      RANK[a.status] - RANK[b.status] ||
      (a.due?.getTime() ?? 0) - (b.due?.getTime() ?? 0) ||
      a.pet.name.localeCompare(b.pet.name),
  );
}

export function usePetSummaries(now: Date): PetSummary[] | undefined {
  return useLiveQuery(async () => {
    const pets = await listActivePets();
    const all = await Promise.all(pets.map(async (p) => summarize(p, await listFeedings(p.id), now)));
    return sortSummaries(all);
  }, [now.getTime()]);
}
