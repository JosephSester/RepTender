import { useLiveQuery } from 'dexie-react-hooks';
import { listSheds } from '../../db/sheds';
import { listPoops } from '../../db/poops';
import { listMeasurements } from '../../db/measurements';
import { listHabitatReadings } from '../../db/habitat';
import { listCareTasks, listCompletions } from '../../db/care';
import { listVetVisits } from '../../db/vetVisits';
import { listNotes } from '../../db/notes';
import type { HusbandryData } from './husbandrySummary';

const EMPTY: HusbandryData = { sheds: [], poops: [], measurements: [], readings: [], tasks: [], completions: [], visits: [], notes: [] };

/** Every husbandry record for one pet (care tasks include the All-pets ones), kept live. */
export function usePetHusbandry(petId: string | undefined): HusbandryData | undefined {
  return useLiveQuery(async () => {
    if (!petId) return EMPTY;
    const [sheds, poops, measurements, readings, tasks, visits, notes] = await Promise.all([
      listSheds(petId),
      listPoops(petId),
      listMeasurements(petId),
      listHabitatReadings(petId),
      listCareTasks(petId),
      listVetVisits(petId),
      listNotes(petId),
    ]);
    const completions = (await Promise.all(tasks.map((t) => listCompletions(t.id)))).flat();
    return { sheds, poops, measurements, readings, tasks, completions, visits, notes };
  }, [petId]);
}
