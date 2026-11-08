import { useLiveQuery } from 'dexie-react-hooks';
import type { Feeding, Pet, Regurgitation } from '../../domain/types';
import { getPet } from '../../db/pets';
import { listFeedings, listRegurgitations } from '../../db/feedings';

export interface PetDetail {
  pet: Pet | null;
  feedings: Feeding[];
  regurgitations: Regurgitation[];
}

export function usePetDetail(id: string | undefined): PetDetail | undefined {
  return useLiveQuery(async () => {
    if (!id) return { pet: null, feedings: [], regurgitations: [] };
    const [pet, feedings, regurgitations] = await Promise.all([
      getPet(id),
      listFeedings(id),
      listRegurgitations(id),
    ]);
    return { pet: pet ?? null, feedings, regurgitations };
  }, [id]);
}
