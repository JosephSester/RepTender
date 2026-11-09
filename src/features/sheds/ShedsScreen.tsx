import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { differenceInCalendarDays, format } from 'date-fns';
import type { ShedQuality } from '../../domain/types';
import { dateKey, parseDateKey } from '../../domain/dates';
import { predictNextShed, shedEtaLabel, shedQualityLabel } from '../../domain/sheds';
import { clearInBlue, deleteShed, listSheds, markInBlue } from '../../db/sheds';
import { saveErrorText } from '../../db/ids';
import { Card } from '../../ui/Card';
import { Pill, type PillTone } from '../../ui/Pill';
import { useNow } from '../../ui/useNow';
import { formatDateKey } from '../pets/format';
import { confirmDelete, PetNotFound, SubScreenHeader, useRoutePet } from '../pets/subScreen';
import LogShedSheet from './LogShedSheet';

const QUALITY_TONE: Record<ShedQuality, PillTone> = { complete: 'ok', partial: 'due', stuck: 'late' };

export default function ShedsScreen({ now: fixedNow }: { now?: Date }) {
  const pet = useRoutePet();
  const now = useNow(fixedNow);
  const petId = pet?.id;
  const sheds = useLiveQuery(() => (petId ? listSheds(petId) : undefined), [petId]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  if (pet === undefined) return null;
  if (pet === null) return <PetNotFound />;
  if (!sheds) return null;
  const prediction = predictNextShed(sheds);
  const history = [...sheds].reverse();

  // One tap at a time: the ref blocks a second tap before React has re-rendered the disabled button.
  const run = async (action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (err) {
      setError(saveErrorText(err));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <SubScreenHeader pet={pet} title="Sheds" addLabel="Log shed" onAdd={() => setAdding(true)} />

      {prediction && (
        <Card style={{ marginTop: 12 }}>
          <div className="row">
            <div className="grow">
              <div className="label" style={{ margin: 0 }}>Next shed expected</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{`Around ${format(prediction.date, 'MMM d')}`}</div>
              <div className="muted">{`Sheds every ~${prediction.averageDays} days`}</div>
            </div>
            <Pill tone={differenceInCalendarDays(prediction.date, now) > 0 ? 'ok' : 'due'}>
              {shedEtaLabel(prediction.date, now)}
            </Pill>
          </div>
          {error && <div role="alert" className="form-error">{error}</div>}
          {pet.inBlueSince ? (
            <div className="row" style={{ marginTop: 10 }}>
              <span className="grow">
                <span aria-hidden="true">👁️ </span>
                {`In blue since ${format(parseDateKey(pet.inBlueSince), 'MMM d')}`}
              </span>
              <button type="button" className="btn" disabled={busy} onClick={() => run(() => clearInBlue(pet.id))}>
                Not in blue
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn-ghost"
              style={{ marginTop: 10 }}
              disabled={busy}
              onClick={() => run(() => markInBlue(pet.id, dateKey(fixedNow ?? new Date())))}
            >
              <span aria-hidden="true">👁️ </span>Mark "in blue" (eyes cloudy)
            </button>
          )}
        </Card>
      )}

      <div className="label">History</div>
      {history.length === 0 && <p className="muted">No sheds logged yet.</p>}
      {history.map((s) => (
        <Card key={s.id} role="article">
          <div className="row">
            <div className="grow">
              <b>{formatDateKey(s.date)}</b>
              <div className="muted">
                {[shedQualityLabel(s.quality), s.inBlueDate && `in blue ${format(parseDateKey(s.inBlueDate), 'MMM d')}`]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              {s.notes && <div style={{ marginTop: 2 }}>{s.notes}</div>}
            </div>
            <Pill tone={QUALITY_TONE[s.quality]}>{shedQualityLabel(s.quality)}</Pill>
            <button type="button" className="btn btn-danger" onClick={() => confirmDelete('shed', () => deleteShed(s.id))}>
              Delete
            </button>
          </div>
        </Card>
      ))}

      <LogShedSheet pet={pet} open={adding} onClose={() => setAdding(false)} now={fixedNow} />
    </>
  );
}
