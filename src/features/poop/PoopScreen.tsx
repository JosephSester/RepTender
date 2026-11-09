import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import type { PoopKind } from '../../domain/types';
import { daysAfterMeal, formatMealGap, formatTypicalGap, POOP_KINDS, poopKindLabel, typicalGap } from '../../domain/poop';
import { listFeedings } from '../../db/feedings';
import { deletePoop, listPoops, logPoop } from '../../db/poops';
import { saveErrorText } from '../../db/ids';
import { Card } from '../../ui/Card';
import { Pill, type PillTone } from '../../ui/Pill';
import { Segmented } from '../../ui/Segmented';
import { useNow } from '../../ui/useNow';
import { formatDaysAgo } from '../pets/format';
import { confirmDelete, PetNotFound, SubScreenHeader, useRoutePet } from '../pets/subScreen';
import LogPoopSheet from './LogPoopSheet';

const KIND_TONE: Record<PoopKind, PillTone> = { normal: 'ok', runny: 'due', urate_only: 'neutral', abnormal: 'late' };

export default function PoopScreen({ now: fixedNow }: { now?: Date }) {
  const pet = useRoutePet();
  const now = useNow(fixedNow);
  const petId = pet?.id;
  const data = useLiveQuery(
    async () => (petId ? { poops: await listPoops(petId), feedings: await listFeedings(petId) } : undefined),
    [petId],
  );
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<PoopKind>('normal');
  const [error, setError] = useState<string>();
  const [logging, setLogging] = useState(false);
  const inFlight = useRef(false);

  if (pet === undefined) return null;
  if (pet === null) return <PetNotFound />;
  if (!data) return null;
  const { poops, feedings } = data;
  const history = [...poops].reverse();
  const last = history[0];
  const gap = typicalGap(poops, feedings);

  const logNow = async () => {
    if (inFlight.current) return; // a double tap must not log two poops
    inFlight.current = true;
    setLogging(true);
    setError(undefined);
    try {
      // The time of the tap, not the minute-old clock of the last render.
      await logPoop({ petId: pet.id, at: (fixedNow ?? new Date()).toISOString(), kind });
    } catch (err) {
      setError(saveErrorText(err));
    } finally {
      inFlight.current = false;
      setLogging(false);
    }
  };

  return (
    <>
      <SubScreenHeader pet={pet} title="Poop log" addLabel="Log poop" onAdd={() => setAdding(true)} />

      <Card style={{ marginTop: 12 }}>
        {last ? (
          <div className="row">
            <div className="grow">
              <div className="label" style={{ margin: 0 }}>Last poop</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                {`${format(parseISO(last.at), 'EEE, MMM d')} · ${formatDaysAgo(parseISO(last.at), now)}`}
              </div>
              {gap && <div className="muted">{formatTypicalGap(gap)}</div>}
            </div>
            <Pill tone={KIND_TONE[last.kind]}>{poopKindLabel(last.kind)}</Pill>
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>No poops logged yet.</p>
        )}
      </Card>

      <div className="label">Log one</div>
      <Card>
        <Segmented label="What did it look like?" options={POOP_KINDS} value={kind} onChange={setKind} />
        {error && <div role="alert" className="form-error">{error}</div>}
        <button type="button" className="btn-primary" style={{ marginTop: 10 }} disabled={logging} onClick={logNow}>
          <span aria-hidden="true">💩 </span>Log poop now
        </button>
      </Card>

      <div className="label">History</div>
      {history.length === 0 && <p className="muted">Nothing logged yet.</p>}
      {history.map((p) => {
        const mealGap = daysAfterMeal(p.at, feedings);
        return (
          <Card key={p.id} role="article">
            <div className="row">
              <div className="grow">
                <b>{format(parseISO(p.at), 'MMM d')}</b>
                {mealGap && <span className="muted">{` · ${formatMealGap(mealGap)}`}</span>}
                {p.notes && <div style={{ marginTop: 2 }}>{p.notes}</div>}
              </div>
              <Pill tone={KIND_TONE[p.kind]}>{poopKindLabel(p.kind)}</Pill>
              <button type="button" className="btn btn-danger" onClick={() => confirmDelete('poop entry', () => deletePoop(p.id))}>
                Delete
              </button>
            </div>
          </Card>
        );
      })}

      <LogPoopSheet pet={pet} open={adding} onClose={() => setAdding(false)} now={now} />
    </>
  );
}
